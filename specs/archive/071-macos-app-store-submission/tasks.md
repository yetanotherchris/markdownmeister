# Tasks: Mac App Store Build Upload

- [x] T001: Read existing specifications, verify builder APIs, and confirm the registered bundle identifier.
- [x] T002: Specify delivery requirements, clarify identity, research tools, and record the implementation plan.
- [x] T003: Add the Store configuration, minimal sandbox entitlements, and delivery helper.
- [x] T004: Add the manual build and upload workflow with isolated credentials and cleanup.
- [x] T005: Add regression tests and update the setup guide with secrets and workflow usage.
- [x] T006: Run applicable local verification and record macOS signing/upload verification gaps.
- [ ] T007: Verify the Store build's folder opening, atomic save, settings persistence, and relaunch access on macOS before submitting for public review. If app behavior changes are needed, specify and test them separately.
- [x] T008: Address PR review findings about unrestricted profile entitlements and codesign's optional certificate extraction prefix, and prove the signature-verification command runs and stops delivery on failure.
- [x] T009: Change manual Store dispatch to numeric `v*` release tags, derive packaging and verification versions from the tag, update the guide, and cover branch and invalid-version rejection before the credential-bearing job.
