function rnd(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

// Generates a random linear equation "ax + b = cx + d" with an integer solution.
export function generateEquation(): { prompt: string; answer: number } {
  const x = rnd(-12, 12);
  const a = rnd(2, 9) * (Math.random() < 0.5 ? -1 : 1);
  let c = rnd(2, 9) * (Math.random() < 0.5 ? -1 : 1);
  while (c === a) c = rnd(2, 9) * (Math.random() < 0.5 ? -1 : 1);
  const b = rnd(-20, 20);
  const d = a * x + b - c * x;

  const fmt = (n: number) => (n < 0 ? `- ${Math.abs(n)}` : `+ ${n}`);
  const left = `${a}x ${fmt(b)}`;
  const right = `${c}x ${fmt(d)}`;
  return { prompt: `${left} = ${right}`, answer: x };
}
