"""Prepare, verify, and upload the Mac App Store package on a macOS runner."""

import argparse
import base64
from datetime import datetime, timezone
import json
import os
from pathlib import Path
import plistlib
import re
import subprocess
import sys

BUNDLE_ID = "dev.yetanotherchris.markdownmeister"
REQUIRED_SECRETS = (
    "MACOS_APP_STORE_CERTIFICATE_P12_BASE64",
    "MACOS_APP_STORE_CERTIFICATE_PASSWORD",
    "MACOS_APP_STORE_INSTALLER_P12_BASE64",
    "MACOS_APP_STORE_INSTALLER_PASSWORD",
    "MACOS_APP_STORE_PROVISIONING_PROFILE_BASE64",
    "APP_STORE_CONNECT_API_KEY_P8_BASE64",
    "APP_STORE_CONNECT_API_KEY_ID",
    "APP_STORE_CONNECT_ISSUER_ID",
)


def run(*args, env=None):
    result = subprocess.run(args, check=True, capture_output=True, env=env)
    return result.stdout


def validate_inputs(version, build_number):
    if not re.fullmatch(r"[1-9][0-9]{0,3}\.(0|[1-9][0-9]{0,3})\.(0|[1-9][0-9]{0,3})", version):
        raise ValueError("Product version must be a three-part numeric release version")
    if not re.fullmatch(r"[1-9][0-9]{0,3}", build_number):
        raise ValueError("Build number must be an integer from 1 to 9999; override it if needed")


def validate_profile(profile, now=None):
    team = profile.get("TeamIdentifier", [])
    if len(team) != 1 or not re.fullmatch(r"[A-Z0-9]{10}", team[0]):
        raise ValueError("Provisioning profile must identify one Apple developer team")
    expiry = profile.get("ExpirationDate")
    now = now or datetime.now(timezone.utc)
    if not isinstance(expiry, datetime) or expiry.replace(tzinfo=timezone.utc) <= now:
        raise ValueError("Provisioning profile is expired or has no expiration date")
    entitlements = profile.get("Entitlements", {})
    prefixes = profile.get("ApplicationIdentifierPrefix", [])
    identifier = entitlements.get("com.apple.application-identifier", entitlements.get("application-identifier"))
    if identifier not in [f"{prefix}.{BUNDLE_ID}" for prefix in prefixes]:
        raise ValueError(f"Provisioning profile must explicitly match {BUNDLE_ID}")
    if entitlements.get("com.apple.developer.team-identifier") != team[0]:
        raise ValueError("Provisioning profile entitlement team does not match its team identifier")
    if entitlements.get("get-task-allow") or entitlements.get("com.apple.security.get-task-allow"):
        raise ValueError("A development provisioning profile cannot be uploaded")
    if profile.get("ProvisionedDevices") or profile.get("ProvisionsAllDevices"):
        raise ValueError("Use a Mac App Store distribution provisioning profile")
    if not profile.get("DeveloperCertificates"):
        raise ValueError("Provisioning profile has no app signing certificates")
    return team[0]


def read_profile(path):
    return plistlib.loads(run("security", "cms", "-D", "-i", str(path)))


def write_private(path, data):
    path.parent.mkdir(parents=True, exist_ok=True, mode=0o700)
    with path.open("xb") as output:
        os.chmod(path, 0o600)
        output.write(data)


def prepare(directory):
    missing = [name for name in REQUIRED_SECRETS if not os.environ.get(name)]
    if missing:
        raise ValueError("Missing environment secrets: " + ", ".join(missing))
    key_id = os.environ["APP_STORE_CONNECT_API_KEY_ID"]
    issuer = os.environ["APP_STORE_CONNECT_ISSUER_ID"]
    if not re.fullmatch(r"[A-Z0-9]{10}", key_id):
        raise ValueError("Invalid App Store Connect key ID")
    if not re.fullmatch(r"[0-9a-fA-F]{8}(-[0-9a-fA-F]{4}){3}-[0-9a-fA-F]{12}", issuer):
        raise ValueError("Invalid App Store Connect issuer ID")
    files = {
        "app.p12": "MACOS_APP_STORE_CERTIFICATE_P12_BASE64",
        "installer.p12": "MACOS_APP_STORE_INSTALLER_P12_BASE64",
        "store.provisionprofile": "MACOS_APP_STORE_PROVISIONING_PROFILE_BASE64",
        f"home/.private_keys/AuthKey_{key_id}.p8": "APP_STORE_CONNECT_API_KEY_P8_BASE64",
    }
    directory.mkdir(mode=0o700, parents=True, exist_ok=False)
    for name, secret in files.items():
        data = base64.b64decode(os.environ[secret], validate=True)
        if not data:
            raise ValueError(f"Empty credential: {secret}")
        write_private(directory / name, data)
    validate_profile(read_profile(directory / "store.provisionprofile"))


def verify(directory, output, version, build_number):
    validate_inputs(version, build_number)
    packages = list(output.rglob("*.pkg"))
    apps = list(output.glob("*/markdownmeister.app"))
    if len(packages) != 1 or len(apps) != 1:
        raise ValueError("Expected exactly one Store .pkg and one universal app bundle")
    package, app = packages[0], apps[0]
    profile_path = directory / "store.provisionprofile"
    profile = read_profile(profile_path)
    team = validate_profile(profile)
    embedded = app / "Contents/embedded.provisionprofile"
    if embedded.read_bytes() != profile_path.read_bytes():
        raise ValueError("Embedded provisioning profile differs from the configured Store profile")
    run("codesign", "--verify", "--deep", "--strict", str(app))
    # codesign sends signature metadata to stderr, even on success.
    details = subprocess.run(
        ["codesign", "--display", "--verbose=4", str(app)],
        check=True, capture_output=True, text=True,
    )
    signature = details.stdout + details.stderr
    if f"TeamIdentifier={team}\n" not in signature:
        raise ValueError("App signature does not match the provisioning profile team")
    if not re.search(r"^Authority=(Apple Distribution|3rd Party Mac Developer Application):", signature, re.M):
        raise ValueError("App must have a Store distribution signature")
    certificate_prefix = directory / "app-signing-"
    run("codesign", "--display", f"--extract-certificates={certificate_prefix}", str(app))
    if Path(f"{certificate_prefix}0").read_bytes() not in profile["DeveloperCertificates"]:
        raise ValueError("App signing certificate is not authorized by the provisioning profile")
    info = plistlib.loads((app / "Contents/Info.plist").read_bytes())
    expected = {
        "CFBundleIdentifier": BUNDLE_ID,
        "CFBundleShortVersionString": version,
        "CFBundleVersion": build_number,
        "ElectronTeamID": team,
    }
    for key, value in expected.items():
        if info.get(key) != value:
            raise ValueError(f"Packaged {key} must equal {value}")
    executable = info.get("CFBundleExecutable", "")
    if not executable or Path(executable).name != executable:
        raise ValueError("Invalid packaged executable name")
    binary = app / "Contents/MacOS" / executable
    architectures = set(run("lipo", "-archs", str(binary)).decode().split())
    if architectures != {"x86_64", "arm64"}:
        raise ValueError("Store app must contain both x86_64 and arm64")
    entitlements = plistlib.loads(run("codesign", "--display", "--entitlements", ":-", str(app)))
    for key in ("com.apple.security.app-sandbox", "com.apple.security.files.user-selected.read-write"):
        if entitlements.get(key) is not True:
            raise ValueError(f"Missing required entitlement: {key}")
    installer_signature = run("pkgutil", "--check-signature", str(package)).decode()
    installer_pattern = rf"^\s*1\. (3rd Party Mac Developer Installer|Mac Installer Distribution): .*\({team}\)\s*$"
    if not re.search(installer_pattern, installer_signature, re.M):
        raise ValueError("Installer must have a Store installer signature from the same team")
    return package


def upload(directory, package):
    environment = dict(
        os.environ,
        HOME=str(directory / "home"),
        API_PRIVATE_KEYS_DIR=str(directory / "home/.private_keys"),
    )
    auth = (
        "--apiKey", os.environ["APP_STORE_CONNECT_API_KEY_ID"],
        "--apiIssuer", os.environ["APP_STORE_CONNECT_ISSUER_ID"],
    )
    run("xcrun", "altool", "--validate-app", "--type", "macos", "--file", str(package), *auth, env=environment)
    run("xcrun", "altool", "--upload-app", "--type", "macos", "--file", str(package), *auth, env=environment)
    print("Upload accepted. Check App Store Connect for processing status; review and release are manual.")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("command", choices=("inputs", "prepare", "verify", "upload"))
    parser.add_argument("--credentials", type=Path)
    parser.add_argument("--output", type=Path, default=Path("dist-store"))
    args = parser.parse_args()
    version = json.loads(Path("package.json").read_text(encoding="utf-8"))["version"]
    build_number = os.environ.get("MACOS_STORE_BUILD_NUMBER", "")
    validate_inputs(version, build_number)
    if args.command == "inputs":
        print(f"Store version {version}, build {build_number}")
        return
    if args.credentials is None:
        parser.error("--credentials is required")
    directory = args.credentials.resolve()
    if args.command == "prepare":
        prepare(directory)
    else:
        package = verify(directory, args.output.resolve(), version, build_number)
        if args.command == "upload":
            upload(directory, package)
        else:
            print(f"Verified Store package: {package.name}")


if __name__ == "__main__":
    try:
        main()
    except subprocess.CalledProcessError as error:
        print(f"{error.cmd[0]} failed with exit code {error.returncode}", file=sys.stderr)
        for data in (error.stdout, error.stderr):
            if data:
                print(data.decode(errors="replace") if isinstance(data, bytes) else data, file=sys.stderr)
        sys.exit(1)
    except (ValueError, OSError, KeyError, plistlib.InvalidFileException) as error:
        print(str(error), file=sys.stderr)
        sys.exit(1)
