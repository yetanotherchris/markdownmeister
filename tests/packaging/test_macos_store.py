import base64
from copy import deepcopy
from datetime import datetime, timedelta, timezone
import importlib.util
import os
from pathlib import Path
import plistlib
import subprocess
import tempfile
import unittest
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[2]
SPEC = importlib.util.spec_from_file_location("macos_store", ROOT / "scripts/macos_store.py")
assert SPEC is not None and SPEC.loader is not None
store = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(store)
TEAM = "ABCDEFGHIJ"


def profile():
    return {
        "TeamIdentifier": [TEAM],
        "ApplicationIdentifierPrefix": [TEAM],
        "ExpirationDate": datetime.now(timezone.utc) + timedelta(days=30),
        "DeveloperCertificates": [b"app-certificate"],
        "Entitlements": {
            "com.apple.application-identifier": f"{TEAM}.{store.BUNDLE_ID}",
            "com.apple.developer.team-identifier": TEAM,
        },
    }


class InputTests(unittest.TestCase):
    def test_accepts_release_version_and_distinct_build_number(self):
        store.validate_inputs("1.8.61", "12")

    def test_rejects_versions_and_build_numbers_apple_cannot_accept(self):
        for version, number in (
            ("1.8.61-beta", "1"), ("v1.8.61", "1"), ("1.8", "1"),
            ("1.8.61", "0"), ("1.8.61", "01"), ("1.8.61", "10000"),
            ("1.8.61", "1\n"), ("1.8.61", "$(command)"),
        ):
            with self.subTest(version=version, number=number), self.assertRaises(ValueError):
                store.validate_inputs(version, number)


class ProfileTests(unittest.TestCase):
    def test_accepts_store_profile_without_unrestricted_sandbox_entitlement(self):
        self.assertEqual(store.validate_profile(profile()), TEAM)

    def test_accepts_store_profile_that_also_lists_sandbox_entitlement(self):
        data = profile()
        data["Entitlements"]["com.apple.security.app-sandbox"] = True
        self.assertEqual(store.validate_profile(data), TEAM)

    def test_accepts_legacy_application_prefix_different_from_team(self):
        data = profile()
        data["ApplicationIdentifierPrefix"] = ["LEGACYPREF"]
        data["Entitlements"]["com.apple.application-identifier"] = f"LEGACYPREF.{store.BUNDLE_ID}"
        self.assertEqual(store.validate_profile(data), TEAM)

    def test_rejects_expired_profile(self):
        data = profile()
        data["ExpirationDate"] = datetime.now(timezone.utc) - timedelta(seconds=1)
        with self.assertRaisesRegex(ValueError, "expired"):
            store.validate_profile(data)

    def test_rejects_wrong_or_wildcard_identifier_and_team_mismatch(self):
        for key, value in (
            ("com.apple.application-identifier", f"{TEAM}.com.yetanotherchris.markdownmeister"),
            ("com.apple.application-identifier", f"{TEAM}.*"),
            ("com.apple.developer.team-identifier", "OTHERTEAM1"),
            ("get-task-allow", True),
        ):
            data = profile()
            data["Entitlements"][key] = value
            with self.subTest(key=key, value=value), self.assertRaises(ValueError):
                store.validate_profile(data)

    def test_rejects_device_bound_and_non_store_profiles(self):
        for key, value in (
            ("ProvisionedDevices", ["device"]), ("ProvisionsAllDevices", True),
            ("DeveloperCertificates", []), ("TeamIdentifier", []),
        ):
            data = profile()
            data[key] = value
            with self.subTest(key=key), self.assertRaises(ValueError):
                store.validate_profile(data)


class DeliveryTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.credentials = self.root / "credentials"
        self.output = self.root / "dist-store"
        self.app = self.output / "mas-universal/markdownmeister.app"
        (self.app / "Contents/MacOS").mkdir(parents=True)
        self.package = self.app.parent / "markdownmeister-1.8.61-macos-store-universal.pkg"
        self.package.touch()
        self.data = profile()
        self.info = {
            "CFBundleIdentifier": store.BUNDLE_ID,
            "CFBundleShortVersionString": "1.8.61",
            "CFBundleVersion": "12",
            "CFBundleExecutable": "markdownmeister",
            "ElectronTeamID": TEAM,
        }
        self.save_info()
        self.credentials.mkdir()
        (self.credentials / "store.provisionprofile").write_bytes(b"signed-profile")
        (self.app / "Contents/embedded.provisionprofile").write_bytes(b"signed-profile")
        self.extracted_certificate = b"app-certificate"
        self.entitlements = {
            "com.apple.security.app-sandbox": True,
            "com.apple.security.files.user-selected.read-write": True,
        }
        self.architectures = b"x86_64 arm64\n"
        self.installer = (
            "Status: signed by a certificate trusted by macOS\n"
            f" 1. 3rd Party Mac Developer Installer: Maintainer ({TEAM})\n"
        )
        self.runner = patch.object(store, "run", side_effect=self.command).start()
        self.addCleanup(patch.stopall)
        patch.object(store, "read_profile", return_value=self.data).start()
        self.signature = subprocess.CompletedProcess(
            [], 0, "", f"Authority=Apple Distribution: Maintainer ({TEAM})\nTeamIdentifier={TEAM}\n"
        )
        patch.object(store.subprocess, "run", return_value=self.signature).start()

    def save_info(self):
        (self.app / "Contents/Info.plist").write_bytes(plistlib.dumps(self.info))

    def command(self, *args, **kwargs):
        if args[0] == "codesign":
            for argument in args:
                if argument.startswith("--extract-certificates="):
                    prefix = argument.split("=", 1)[1]
                    Path(f"{prefix}0").write_bytes(self.extracted_certificate)
        if args[0] == "lipo":
            return self.architectures
        if args[0] == "pkgutil":
            return self.installer.encode()
        if "--entitlements" in args:
            return plistlib.dumps(self.entitlements)
        return b""

    def verify(self):
        return store.verify(self.credentials, self.output, "1.8.61", "12")

    def test_verifies_universal_distribution_package(self):
        self.assertEqual(self.verify(), self.package)
        self.runner.assert_any_call("codesign", "--verify", "--deep", "--strict", str(self.app))
        self.runner.assert_any_call(
            "codesign", "--display",
            f"--extract-certificates={self.credentials / 'app-signing-'}", str(self.app),
        )

    def test_rejects_universal_app_missing_an_architecture(self):
        self.architectures = b"arm64"
        with self.assertRaisesRegex(ValueError, "both x86_64 and arm64"):
            self.verify()

    def test_rejects_wrong_identity_version_build_and_team(self):
        for key in ("CFBundleIdentifier", "CFBundleShortVersionString", "CFBundleVersion", "ElectronTeamID"):
            with self.subTest(key=key):
                original = self.info[key]
                self.info[key] = "wrong"
                self.save_info()
                with self.assertRaisesRegex(ValueError, key):
                    self.verify()
                self.info[key] = original

    def test_rejects_profile_not_embedded_in_app(self):
        (self.app / "Contents/embedded.provisionprofile").write_bytes(b"other-profile")
        with self.assertRaisesRegex(ValueError, "Embedded provisioning profile"):
            self.verify()

    def test_rejects_signer_not_authorized_by_profile(self):
        self.extracted_certificate = b"other-certificate"
        with self.assertRaisesRegex(ValueError, "not authorized"):
            self.verify()

    def test_rejects_developer_id_app_signature(self):
        self.signature.stderr = f"Authority=Developer ID Application: Maintainer ({TEAM})\nTeamIdentifier={TEAM}\n"
        with self.assertRaisesRegex(ValueError, "Store distribution signature"):
            self.verify()

    def test_rejects_wrong_installer_team_or_developer_id_installer(self):
        for signature in (
            " 1. 3rd Party Mac Developer Installer: Maintainer (OTHERTEAM1)\n",
            f" 1. Developer ID Installer: Maintainer ({TEAM})\n",
        ):
            with self.subTest(signature=signature):
                self.installer = signature
                with self.assertRaisesRegex(ValueError, "Store installer signature"):
                    self.verify()

    def test_rejects_missing_sandbox_or_read_write_access(self):
        for key in deepcopy(self.entitlements):
            with self.subTest(key=key):
                self.entitlements[key] = False
                with self.assertRaisesRegex(ValueError, "Missing required entitlement"):
                    self.verify()
                self.entitlements[key] = True

    def test_stops_on_signature_verification_failure(self):
        def fail_signature_verification(*args, **kwargs):
            if args[:2] == ("codesign", "--verify"):
                raise subprocess.CalledProcessError(1, list(args))
            return self.command(*args, **kwargs)

        self.runner.side_effect = fail_signature_verification
        with self.assertRaises(subprocess.CalledProcessError):
            self.verify()
        self.runner.assert_called_once_with("codesign", "--verify", "--deep", "--strict", str(self.app))

    def test_rejects_ambiguous_package_selection(self):
        (self.output / "another.pkg").touch()
        with self.assertRaisesRegex(ValueError, "exactly one"):
            self.verify()

    def test_validation_failure_prevents_upload(self):
        self.runner.side_effect = subprocess.CalledProcessError(1, ["xcrun"])
        with patch.dict(os.environ, {
            "APP_STORE_CONNECT_API_KEY_ID": "KEY1234567",
            "APP_STORE_CONNECT_ISSUER_ID": "issuer",
        }), self.assertRaises(subprocess.CalledProcessError):
            store.upload(self.credentials, self.package)
        self.assertEqual(self.runner.call_count, 1)
        self.assertIn("--validate-app", self.runner.call_args.args)

    def test_upload_failure_propagates_without_retry(self):
        self.runner.side_effect = [b"validated", subprocess.CalledProcessError(1, ["xcrun"])]
        with patch.dict(os.environ, {
            "APP_STORE_CONNECT_API_KEY_ID": "KEY1234567",
            "APP_STORE_CONNECT_ISSUER_ID": "issuer",
        }), self.assertRaises(subprocess.CalledProcessError):
            store.upload(self.credentials, self.package)
        self.assertEqual(self.runner.call_count, 2)
        self.assertIn("--upload-app", self.runner.call_args.args)

    def test_upload_uses_existing_api_key_in_temporary_search_directory(self):
        with patch.dict(os.environ, {
            "APP_STORE_CONNECT_API_KEY_ID": "KEY1234567",
            "APP_STORE_CONNECT_ISSUER_ID": "issuer",
        }):
            store.upload(self.credentials, self.package)
        self.assertEqual(self.runner.call_count, 2)
        arguments = self.runner.call_args.args
        self.assertIn("KEY1234567", arguments)
        self.assertNotIn("--password", arguments)
        environment = self.runner.call_args.kwargs["env"]
        self.assertEqual(environment["API_PRIVATE_KEYS_DIR"], str(self.credentials / "home/.private_keys"))


class CredentialTests(unittest.TestCase):
    def test_requires_every_secret(self):
        with patch.dict(os.environ, {}, clear=True), self.assertRaisesRegex(ValueError, "Missing environment secrets"):
            store.prepare(Path("unused"))

    def test_decodes_files_outside_artifacts_and_validates_profile(self):
        secrets = {name: base64.b64encode(b"credential").decode() for name in store.REQUIRED_SECRETS}
        secrets["APP_STORE_CONNECT_API_KEY_ID"] = "KEY1234567"
        secrets["APP_STORE_CONNECT_ISSUER_ID"] = "12345678-1234-1234-1234-123456789012"
        with tempfile.TemporaryDirectory() as temp, patch.dict(os.environ, secrets), \
                patch.object(store, "read_profile", return_value=profile()) as read:
            directory = Path(temp) / "credentials"
            store.prepare(directory)
            self.assertEqual((directory / "app.p12").read_bytes(), b"credential")
            self.assertEqual((directory / "home/.private_keys/AuthKey_KEY1234567.p8").read_bytes(), b"credential")
            read.assert_called_once_with(directory / "store.provisionprofile")
            if os.name != "nt":
                self.assertEqual((directory / "app.p12").stat().st_mode & 0o777, 0o600)

    def test_rejects_key_id_path_injection_before_creating_files(self):
        secrets = {name: "present" for name in store.REQUIRED_SECRETS}
        secrets["APP_STORE_CONNECT_API_KEY_ID"] = "../../bad"
        with patch.dict(os.environ, secrets), self.assertRaisesRegex(ValueError, "key ID"):
            store.prepare(Path("unused"))


if __name__ == "__main__":
    unittest.main()
