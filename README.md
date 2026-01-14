# json-viewer (Content-Aware Formatter)

## Quickstart (Development)

### Prereqs

- Node.js 18+ (recommended: latest LTS)

### Install + run

```bash
npm install
npm run dev
```

Then open the local URL printed by Vite.

## Deploy (GitHub Pages)

This project is configured to deploy automatically to **GitHub Pages** on every push to the `main` branch via `.github/workflows/deploy-pages.yml`.

### One-time repo setting

In your GitHub repo:

- Go to **Settings → Pages**
- Under **Build and deployment**, set **Source** to **GitHub Actions**

After that, push to `main` (or run the workflow manually from the **Actions** tab). The workflow will publish the `dist/` folder.

### Usage

- Paste content into **Input**
- Press **Format** (or **Ctrl/Cmd + Enter**)
- Switch to **Output** (auto-switches after formatting)
- Use **Copy output** to copy the formatted result

### Notes

- Client-only: all formatting runs locally in your browser; nothing is sent anywhere.
- Offline after load: the app registers a small service worker so it works after the first load.

## 1. Introduction

### 1.1 Purpose

This document defines the requirements for a **Content-Aware Formatter**, a single-page web application that formats unstructured or minified text into human-readable formats such as JSON, XML, and common programming languages. The document serves as a reference for developers, designers, and stakeholders involved in building or maintaining the system.

### 1.2 Scope

The application will be a lightweight, client-side-only web tool that allows users to paste text and format it with one action. The tool is intended for developers and technical users who frequently work with structured data and source code.

### 1.3 Definitions and Abbreviations

* **MVP**: Minimum Viable Product
* **SPA**: Single Page Application
* **AST**: Abstract Syntax Tree

---

## 2. Overall Description

### 2.1 Product Perspective

The Content-Aware Formatter is a standalone, browser-based utility. It does not depend on any backend services and runs entirely in the client’s browser.

### 2.2 User Classes and Characteristics

* **Developers**: Familiar with JSON, XML, and programming languages
* **DevOps Engineers**: Use formatted output for logs and configurations
* **Students / Learners**: Require readable structured data

### 2.3 Operating Environment

* Modern web browsers (Chrome, Firefox, Safari, Edge)
* Desktop and tablet devices
* Offline-capable after initial load

### 2.4 Constraints

* No server-side processing
* No persistent storage in MVP
* Must not transmit user data externally

---

## 3. Functional Requirements

### 3.1 Text Input

* The system shall provide a multiline text input area.
* The system shall allow users to paste raw or minified text.
* The system shall support inputs up to approximately 1–2 MB.

### 3.2 Formatting Trigger

* The system shall provide a primary **Format** button.
* The system shall support keyboard shortcuts:

  * Ctrl + Enter (Windows/Linux)
  * Cmd + Enter (macOS)

### 3.3 Content Detection

* The system shall automatically detect the content type.
* Detection shall attempt formats in the following order:

  1. JSON
  2. XML
  3. Python
  4. JavaScript / TypeScript
  5. Plain text (fallback)

### 3.4 Formatting Rules

* **JSON**: Pretty-print with consistent indentation (default 2 spaces).
* **XML**: Normalize indentation and tag hierarchy.
* **Python**: Normalize indentation and remove trailing whitespace.
* **JavaScript / TypeScript**: Standardize indentation and brace alignment.

### 3.5 Output Display

* The system shall display formatted output in a read-only area.
* The output shall preserve semantic structure.
* The output area shall be scrollable and selectable.

### 3.6 Error Handling

* The system shall detect malformed input.
* The system shall display user-friendly error messages.
* The system shall not modify the input on formatting errors.

---

## 4. Non-Functional Requirements

### 4.1 Performance

* Formatting should complete within 100 ms for typical inputs.
* The UI shall remain responsive during processing.

### 4.2 Security and Privacy

* All processing shall occur locally in the browser.
* No user input shall be transmitted or logged externally.

### 4.3 Usability

* The interface shall be minimal and distraction-free.
* The system shall be usable with keyboard-only navigation.

### 4.4 Reliability

* The system shall not crash on invalid or unexpected input.
* Failures shall degrade gracefully with clear messages.

---

## 5. User Interface Requirements

### 5.1 Layout

* Single page layout.
* Minimal control button layer on top (5% of total screen height).
* The rest should be a single big text box

### 5.2 Controls

* Format button
* Optional buttons:

  * Clear Input
  * Copy Output

### 5.3 Visual Design

* Monospaced fonts for text areas
* Light theme by default
* Optional dark mode

---

## 6. Accessibility Requirements

* All interactive elements shall be keyboard accessible.
* Text contrast shall meet WCAG AA guidelines.
* Form controls shall include accessible labels.

---

## 7. Out of Scope (MVP)

* Manual format selection override
* Diff view
* Minification features
* YAML, SQL, or Markdown formatting
* Cloud storage or user accounts

---

## 8. Future Enhancements

* AST-based formatting for Python and TypeScript
* Plugin-based formatter architecture
* Shareable links for formatted content
* Download formatted output as files

---

## 9. Acceptance Criteria

* User can paste raw JSON and format it in one action.
* The application works offline after load.
* Invalid input produces clear, non-blocking errors.
* Formatting completes instantly for normal use cases.

---

**End of Document**
