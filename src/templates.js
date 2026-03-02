// ─── Built-in templates ───────────────────────────────────────────────────────
export const BUILT_IN_TEMPLATES = [
    {
        label: 'Blank',
        content: '',
    },
    {
        label: 'Daily Note',
        content: `# {{DATE}}

## Tasks
- [ ] 

## Notes

## Log
`,
    },
    {
        label: 'Meeting Notes',
        content: `# Meeting — {{DATE}}

**Attendees:**

**Agenda:**
1. 

## Notes

## Action Items
- [ ] 
`,
    },
    {
        label: 'Blog Post',
        content: `# Title

> Short description or excerpt.

## Introduction

## Main Content

## Conclusion
`,
    },
    {
        label: 'Project Brief',
        content: `# Project Name

## Overview

## Goals
- 

## Scope

## Timeline

## Notes
`,
    },
];

// ─── Macro expansion ──────────────────────────────────────────────────────────
export { expandMacros as applyTemplateMacros } from './macros.js';
