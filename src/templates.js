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
    {
        label: 'Screenplay',
        content: `# Title
### Written by

---

## ACT ONE

**FADE IN:**

**INT. LOCATION — DAY**

*Description of the scene. Set the tone, establish the space.*

**CHARACTER NAME**
Dialogue goes here.

**ANOTHER CHARACTER**
Response dialogue here.

*Action line. What we see happening.*

**CUT TO:**

---

## ACT TWO

**INT. LOCATION — NIGHT**

*Description.*

**CHARACTER NAME**
Dialogue.

**CUT TO:**

---

## ACT THREE

**INT. LOCATION — DAY**

*Description.*

**CHARACTER NAME**
Final dialogue.

**FADE OUT.**

---

*THE END*
`,
    },
];

// ─── Macro expansion ──────────────────────────────────────────────────────────
export { expandMacros as applyTemplateMacros } from './macros.js';
