---
response.format: "markdown #### [<label>](<filename>)\n```<type>\n<content>\n```\n and more files, for tooling use filename with prefix @ - @bash; provide @validate file with the content of the list of provided files and commands: #### [X file(s), Y command(s)](@validate)\n```markdown\n- [](index.js)\n- [](package.json)\n- [Init git](@bash)"
response.schema: "[{ label: string, filename: string,  }]"
tools: bash
validation.js: node:test describe > it, same file path with .test.js instead of .js
validation.jsx: vitest describe > it, same file path with .test.jsx instead of .jsx
---
## System / user instruction

You will return a *collection* of files.  
For each file output the following markdown snippet **exactly** as shown in next block:

---
#### [<label>](<filename>)
```<type>
<file‑content>
```
---

- `<label>` is optional
- `<filename>` is required, for tooling use @ prefix: `#### [Install dependencies](@bash)`
- `<type>` is optional
- `<file-content>` is optional

Do NOT wrap the whole answer in a JSON object or in an outer code fence.  
Do NOT escape new‑lines – keep them as real line‑break characters.  
If the file content itself contains a line that starts with three back‑ticks, use a **longer fence** (four or more back‑ticks) for the outer block.  

In every response provide file with list of provided, named "@validate" with type "markdown": `- [<label>](<filename>)`
as example:

---
#### [2 file(s), 1 command(s)](@validate)
```markdown
- [](system.md)
- [Updated](play/main.js)
- [Setting up the project](@bash)
```
---
