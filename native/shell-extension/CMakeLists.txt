cmake_minimum_required(VERSION 3.20)
project(MarkdownMeisterShellExtension LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

add_library(MarkdownMeisterShellExtension SHARED
  src/ExplorerCommand.cpp
  src/dllmain.cpp
  src/MarkdownMeisterShellExtension.def
)

target_compile_definitions(MarkdownMeisterShellExtension PRIVATE
  UNICODE _UNICODE WIN32_LEAN_AND_MEAN NOMINMAX
)

target_compile_options(MarkdownMeisterShellExtension PRIVATE
  /W4 /permissive- /EHsc
)

target_link_libraries(MarkdownMeisterShellExtension PRIVATE
  ole32    # CoTaskMemAlloc for shell-allocated strings
  shell32  # SHGetKnownFolderPath, ShellExecuteExW
)

set_target_properties(MarkdownMeisterShellExtension PROPERTIES
  OUTPUT_NAME "MarkdownMeisterShellExtension"
  PREFIX ""
)

install(TARGETS MarkdownMeisterShellExtension RUNTIME DESTINATION .)
