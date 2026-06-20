---
name: pdf-processing
description: Extracts text, tables, and form fields from PDF files, and splits, merges, or fills them. Use when the user wants to read, parse, combine, or fill PDF documents, or mentions PDFs, forms, or scanned pages.
license: MIT
---

# PDF processing

A small, well-formed example skill used to demonstrate a clean `skillspec` run.

## Reading a PDF

Use a PDF library to extract the text layer. For scanned documents, fall back to
OCR before extraction.

## Filling forms

Map field names to values and write a flattened copy so the result is not
editable downstream.

## Merging and splitting

Combine documents in the requested order, or split on a page range.
