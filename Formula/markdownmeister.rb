class Markdownmeister < Formula
  desc "A WYSIWYG markdown editor for Windows, macOS, and Linux, built with Electron and Milkdown."
  homepage "https://github.com/yetanotherchris/markdownmeister"
  version "1.4.0"
  license "MIT"

  on_macos do
    if Hardware::CPU.arm?
      url "https://github.com/yetanotherchris/markdownmeister/releases/download/v1.4.0/markdownmeister-1.4.0-macos-arm64.zip"
      sha256 "3f529f99488db89c1ff50447bc5c679324eba0dd04326637119804b11bdc13e3"
    else
      url "https://github.com/yetanotherchris/markdownmeister/releases/download/v1.4.0/markdownmeister-1.4.0-macos-x64.zip"
      sha256 "d10f41139f6add93f4fcb938ff83cceafed5427829771aa0589062ca58773698"
    end
  end

  on_linux do
    if Hardware::CPU.arm?
      odie "MarkdownMeister does not provide a Linux arm64 build"
    else
      url "https://github.com/yetanotherchris/markdownmeister/releases/download/v1.4.0/markdownmeister-1.4.0-linux-x64.AppImage"
      sha256 "550bb03f1e32a9ed2dba757ce161024e791c22e92f01b20a77cff6e3bc83bea0"
    end
  end

  def install
    if OS.mac?
      app.install "MarkdownMeister.app"
    else
      bin.install "markdownmeister-1.4.0-linux-x64.AppImage" => "markdownmeister"
    end
  end

  test do
    if OS.mac?
      assert_predicate prefix/"MarkdownMeister.app", :exist?
    else
      assert_predicate bin/"markdownmeister", :exist?
    end
  end
end
