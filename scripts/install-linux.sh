#!/bin/sh
# Download the latest MarkdownMeister release and install it.
# Default: the x86-64 .deb, for Debian, Ubuntu, Mint, and Pop!_OS.
# --appimage: the x86-64 AppImage, saved in the current directory and started.
set -eu

repo=yetanotherchris/markdownmeister

usage() {
  echo "Usage: install-linux.sh [--appimage]" >&2
  exit 1
}

mode=deb
if [ "${1:-}" = "--appimage" ]; then
  mode=appimage
elif [ "${1:-}" != "" ]; then
  usage
fi
if [ "$#" -gt 1 ]; then
  usage
fi

arch=$(uname -m)
if [ "$arch" != "x86_64" ] && [ "$arch" != "amd64" ]; then
  echo "MarkdownMeister publishes x86-64 packages only (this machine is ${arch})." >&2
  exit 1
fi

tag=$(
  curl -fsSL -H "Accept: application/vnd.github+json" \
    "https://api.github.com/repos/${repo}/releases/latest" |
    grep -o '"tag_name": *"[^"]*"' |
    head -n 1 |
    cut -d '"' -f 4
)
case "$tag" in
  v[0-9]*) version=${tag#v} ;;
  *)
    echo "Could not read the latest release tag." >&2
    exit 1
    ;;
esac
case "$version" in
  *[!0-9.]*)
    echo "Could not read the latest release tag." >&2
    exit 1
    ;;
esac

if [ "$mode" = "appimage" ]; then
  file="markdownmeister-${version}-linux-x64.AppImage"
  echo "Downloading ${file}"
  curl -fL -o "$file" "https://github.com/${repo}/releases/download/${tag}/${file}"
  chmod +x "$file"
  exec "./$file"
fi

file="markdownmeister_${version}_amd64.deb"
dir=$(mktemp -d)
trap 'rm -rf "$dir"' EXIT
echo "Downloading ${file}"
curl -fL -o "${dir}/${file}" "https://github.com/${repo}/releases/download/${tag}/${file}"
if [ "$(id -u)" -eq 0 ]; then
  apt-get install -y "${dir}/${file}"
else
  sudo apt-get install -y "${dir}/${file}"
fi
