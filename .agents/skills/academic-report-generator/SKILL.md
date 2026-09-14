---
name: academic-report-generator
description: >-
  Comprehensive guide and structured workflow for researching, structuring, drafting, formatting,
  and generating formal academic reports, research papers, capstone/thesis documents, and technical
  investigations using standardized academic conventions (IEEE, APA, Harvard) and document tools.
---

# Academic Report Generator Skill

This skill provides an end-to-end framework and best practices for creating rigorous, high-quality academic and technical reports. Use this skill whenever a user requests an academic report, research paper, literature review, technical evaluation, thesis chapter, or project documentation.

---

## 1. Standard Academic Report Structure

Every formal academic report must adhere to a standardized hierarchy:

```
├── 1. Title & Metadata (Title, Author, Affiliation, Date)
├── 2. Abstract & Keywords (Executive summary of scope, method, key findings)
├── 3. Table of Contents / Figures / Tables (Optional for short reports)
├── 4. Introduction
│   ├── Background & Problem Statement
│   ├── Research Objectives / Research Questions
│   └── Scope & Document Organization
├── 5. Literature Review / Theoretical Framework
│   ├── Current State of the Art / Prior Work
│   └── Identified Research Gaps
├── 6. Methodology / System Design
│   ├── Framework / Experimental Design
│   ├── Data Collection & Processing
│   └── Evaluation Metrics & Tools
├── 7. Results & Analysis
│   ├── Quantitative & Qualitative Findings
│   └── Comparative Analysis / Benchmarking
├── 8. Discussion & Implications
│   ├── Interpretation of Results
│   ├── Limitations & Threats to Validity
│   └── Practical / Academic Significance
├── 9. Conclusion & Future Work
├── 10. References & Bibliography (APA, IEEE, or Harvard style)
└── 11. Appendices (Supplementary data, schemas, questionnaires, raw code)
```

---

## 2. Academic Tone & Writing Conventions

- **Formal Third-Person Perspective:** Use objective, scholarly language (e.g., *"The results demonstrate..."* instead of *"I found that..."*).
- **Precision & Clarity:** Avoid colloquialisms, vague modifiers (*"very good"*, *"a lot of"*), or unsubstantiated claims.
- **Evidence-Based Arguments:** Back every non-obvious assertion with empirical data, mathematical proof, or peer-reviewed literature citations.
- **Consistent Tense Usage:**
  - *Past Tense:* For procedures conducted, experiments executed, and observed results (*"The model achieved 94% accuracy"*).
  - *Present Tense:* For established general facts, active literature arguments, and document structure roadmap (*"Figure 2 illustrates...", "Smith (2023) argues that..."*).

---

## 3. Citation & Referencing Styles

Follow the requested citation style strictly:

### IEEE Format (Common in Engineering & Computer Science)
- **In-text:** Numerical brackets sequentially ordered: `[1]`, `[2, pp. 45-50]`.
- **Reference list:**
  - *Paper:* `[1] J. Doe and A. Smith, "Deep learning optimizations in cloud systems," IEEE Trans. Comput., vol. 12, no. 3, pp. 100-112, 2024.`
  - *Book:* `[2] R. Sutton and A. Barto, Reinforcement Learning: An Introduction, 2nd ed. Cambridge, MA: MIT Press, 2018.`

### APA 7th Edition (Common in Social Sciences & General Computing)
- **In-text:** Author-date format: `(Doe & Smith, 2024)` or `Doe and Smith (2024) noted that...`.
- **Reference list:**
  - `Doe, J., & Smith, A. (2024). Deep learning optimizations in cloud systems. Journal of Computing, 12(3), 100–112. https://doi.org/10.xxxx`

### Harvard Style (Common in Business & Interdisciplinary Studies)
- **In-text:** Author-date format: `(Doe and Smith, 2024)`.
- **Reference list:**
  - `Doe, J. and Smith, A., 2024. Deep learning optimizations in cloud systems. Journal of Computing, 12(3), pp.100–112.`

---

## 4. End-to-End Generation Workflow

When tasked with creating an academic report:

### Step 1: Requirements & Scope Definition
1. Identify the topic, target audience, required citation style, word/page count, and formatting constraints.
2. Formulate clear research questions or project objectives.

### Step 2: Outline & Structure Approval
1. Draft a structured table of contents / outline.
2. Align on the level of depth for literature review, methodology, and experimental results.

### Step 3: Drafting Content
1. **Introduction:** Hook the reader with domain context, pinpoint the exact problem, and state the contribution clearly.
2. **Methodology:** Provide enough technical depth and mathematical/procedural rigor for reproducibility.
3. **Data & Results:** Structure findings with clear headings, tables, formulas, or comparative metrics.
4. **Discussion:** Synthesize what the results mean, address anomalies, and discuss constraints.

### Step 4: Formatting & Export
- If generating a **Microsoft Word document (`.docx`)** via Word MCP:
  - Apply standard margins (1 inch / 72 pt).
  - Use standard typography (e.g., Calibri 11pt, Times New Roman 12pt, or Georgia 11pt).
  - Apply hierarchical styles (`Heading 1`, `Heading 2`, `Heading 3`, `Normal`).
  - Format tables with clear header rows and consistent borders.
  - Insert page numbering and headers/footers where appropriate.
- If generating **Markdown / LaTeX**:
  - Use standard LaTeX math syntax (`$..$`, `$$..$$`, KaTeX).
  - Ensure tables and figure callouts are clearly cross-referenced.

---

## 5. Quality & Rigor Checklist

Before finalizing an academic report, verify:
- [ ] Clear research questions / objective statement in the Introduction.
- [ ] Methodological steps are complete and replicable.
- [ ] All claims are supported by citations or empirical data.
- [ ] Figures, tables, and algorithms are properly numbered and labeled with captions.
- [ ] Citations and references match 1:1 (no missing or dangling citations).
- [ ] Neutral, formal academic voice throughout.
- [ ] Executive summary/abstract accurately reflects the conclusion and main findings.
