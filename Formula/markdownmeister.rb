class Markdownmeister < Formula
  desc "A WYSIWYG markdown editor for Windows, macOS, and Linux, built with Electron and Milkdown."
  homepage "https://github.com/yetanotherchris/markdownmeister"
  version "1.2.1"
  license "MIT"

  on_macos do
    if Hardware::CPU.arm?
      url "https://github.com/yetanotherchris/markdownmeister/releases/download/v1.2.1/markdownmeister-1.2.1-macos-arm64.zip"
      sha256 "7a95519896d34baca8221d762be4d05bf344d69da312831a10ee2c0a6e99b05a"
    else
      url "https://github.com/yetanotherchris/markdownmeister/releases/download/v1.2.1/markdownmeister-1.2.1-macos-x64.zip"
      sha256 "36b028be6d98421683d3f32ff0123e880ec6f968b36f651db7dd8be3c9acfcd8"
    end
  end

  on_linux do
    if Hardware::CPU.arm?
      odie "MarkdownMeister does not provide a Linux arm64 build"
    else
      url "https://github.com/yetanotherchris/markdownmeister/releases/download/v1.2.1/markdownmeister-1.2.1-linux-x64.AppImage"
      sha256 "4911c27704fda9cfe40537ac68a913a7ca541e420829bdbd260c126c1e28988c"
    end
  end

  def install
    if OS.mac?
      app.install "MarkdownMeister.app"
    else
      bin.install "markdownmeister-1.2.1-linux-x64.AppImage" => "markdownmeister"
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
