---
name: release-notes
description: Drafts release notes and changelog entries from merged pull requests and commit history. Use when the user asks to write release notes, prepare a release, update the CHANGELOG, or summarize what changed since the last tag.
allowed-tools: Bash(git:*) Read
metadata:
  author: Blaze
  version: "1.0"
---

# Release notes

A clean example skill that also exercises `allowed-tools` and `metadata`.

## Gather changes

Collect merged pull requests and commits since the previous release tag.

## Group and write

Group changes into Added / Changed / Fixed and write a concise entry per group,
leading with user-visible impact.
