import { useMemo } from "react";
import katex from "katex";

// The source content stores formulas as plain algebraic notation (unicode
// sub/superscripts, "·", "−", "/" for fractions) rather than LaTeX. This
// converts the specific notation patterns this dataset uses into LaTeX so
// they can render through KaTeX; anything it can't confidently convert is
// left as-is and KaTeX still typesets plain variables/operators fine.
const SUPERSCRIPTS: Record<string, string> = { "⁰": "0", "¹": "1", "²": "2", "³": "3", "⁴": "4", "⁵": "5", "⁶": "6", "⁷": "7", "⁸": "8", "⁹": "9" };
const SUBSCRIPTS: Record<string, string> = { "₀": "0", "₁": "1", "₂": "2", "₃": "3", "₄": "4", "₅": "5", "₆": "6", "₇": "7", "₈": "8", "₉": "9" };

function convertScripts(input: string): string {
  let out = "";
  for (let i = 0; i < input.length; i++) {
    const ch = input[i];
    if (SUPERSCRIPTS[ch]) {
      let digits = "";
      while (i < input.length && SUPERSCRIPTS[input[i]]) {
        digits += SUPERSCRIPTS[input[i]];
        i++;
      }
      i--;
      out += `^{${digits}}`;
    } else if (SUBSCRIPTS[ch]) {
      let digits = "";
      while (i < input.length && SUBSCRIPTS[input[i]]) {
        digits += SUBSCRIPTS[input[i]];
        i++;
      }
      i--;
      out += `_{${digits}}`;
    } else {
      out += ch;
    }
  }
  return out;
}

function wrapCyrillic(input: string): string {
  // Wraps runs of Cyrillic letters (plus hyphens inside them, e.g. "в-ва")
  // in \text{}, so KaTeX doesn't italicize them as if they were variables.
  return input.replace(/[А-Яа-яЁё][А-Яа-яЁё-]*/g, (m) => `\\text{${m}}`);
}

function convertFractions(input: string): string {
  const token = "(?:\\([^()]+\\)|[A-Za-zА-Яа-я0-9^{}_.,+-]+)";
  const re = new RegExp(`(${token})\\s*/\\s*(${token})`, "g");
  let prev = input;
  for (let pass = 0; pass < 3; pass++) {
    const next = prev.replace(re, (_m, a: string, b: string) => {
      const strip = (s: string) => (s.startsWith("(") && s.endsWith(")") ? s.slice(1, -1) : s);
      return `\\dfrac{${strip(a)}}{${strip(b)}}`;
    });
    if (next === prev) break;
    prev = next;
  }
  return prev;
}

function plainMathToLatex(input: string): string {
  let s = input;
  s = convertFractions(s);
  s = convertScripts(s);
  s = wrapCyrillic(s);
  s = s
    .replace(/·/g, "\\cdot ")
    .replace(/−/g, "-")
    .replace(/≠/g, "\\neq ")
    .replace(/≥/g, "\\geq ")
    .replace(/≤/g, "\\leq ")
    .replace(/±/g, "\\pm ")
    .replace(/→/g, "\\to ")
    .replace(/≈/g, "\\approx ")
    .replace(/√/g, "\\sqrt");
  return s;
}

function renderKatex(latex: string, displayMode: boolean): string | null {
  try {
    return katex.renderToString(latex, { throwOnError: true, displayMode, strict: false });
  } catch {
    return null;
  }
}

/** Renders one algebraic line (as used in ContentBlock formula.lines / worked-example steps). */
export function FormulaLine({ text, display = true }: { text: string; display?: boolean }) {
  const html = useMemo(() => {
    const latex = plainMathToLatex(text);
    return renderKatex(latex, display);
  }, [text, display]);

  if (html) return <span dangerouslySetInnerHTML={{ __html: html }} />;
  return <span style={{ fontFamily: "var(--font-heading)" }}>{text}</span>;
}

// Matches maximal runs of math-looking characters (digits, single Latin
// variable letters, unicode sub/superscripts, operators, fractions,
// parens) inline inside Russian prose, so exercise prompts like
// "Решите уравнение: 12 / x = 4." typeset the whole equation as one
// contiguous KaTeX span instead of splitting on the first operator.
const MATH_CLUSTER_RE =
  /[0-9A-Za-z(][0-9A-Za-z()=<>≠≥≤±·+\-−/²³¹⁰⁴-⁹₀-₉]*(?:[ \t](?=[0-9A-Za-z(=<>≠≥≤±·+\-−/])[0-9A-Za-z()=<>≠≥≤±·+\-−/²³¹⁰⁴-⁹₀-₉]*)*/g;
const HAS_OPERATOR_RE = /[=<>≠≥≤±/]/;

/** Renders prose that may contain inline equations (exercise prompts, options). */
export function MathText({ text }: { text: string }) {
  const parts = useMemo(() => {
    const segments: { math: boolean; text: string }[] = [];
    let lastIndex = 0;
    const re = new RegExp(MATH_CLUSTER_RE);
    let match: RegExpExecArray | null;
    while ((match = re.exec(text))) {
      const candidate = match[0];
      if (!HAS_OPERATOR_RE.test(candidate)) continue; // plain word/number — leave as prose
      if (match.index > lastIndex) segments.push({ math: false, text: text.slice(lastIndex, match.index) });
      segments.push({ math: true, text: candidate });
      lastIndex = match.index + candidate.length;
    }
    if (lastIndex < text.length) segments.push({ math: false, text: text.slice(lastIndex) });
    return segments;
  }, [text]);

  return (
    <>
      {parts.map((p, i) =>
        p.math ? <FormulaLine key={i} text={p.text} display={false} /> : <span key={i}>{p.text}</span>,
      )}
    </>
  );
}
