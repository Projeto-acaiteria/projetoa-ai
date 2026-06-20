// Parser de peso de balança serial — protocolo Toledo (padrão de fato no Brasil), confirmado na
// pesquisa COMANDAPRO-PESQUISA-BALANCA.md: quadro STX(0x02) + 5 dígitos ASCII (2 inteiros + 3 decimais
// = kg) + ETX(0x03). Ex: "01250" = 1,250 kg = 1250 g. Status IIIII/NNNNN/SSSSS = instável/negativo/
// sobrecarga → descartado (peso só vale ESTÁVEL — λ.prova-na-fonte: não aceita o 1º byte que chega).
// Função PURA (sem QZ/DOM) pra ser testável. A leitura via QZ Tray vive em qz.ts.

const STX = "\x02";
const ETX = "\x03";

/** Extrai os GRAMAS do último quadro estável de um buffer serial. null se não há peso estável. */
export function parseScaleWeight(buffer: string): number | null {
  let grams: number | null = null;
  let i = 0;
  while (i < buffer.length) {
    const start = buffer.indexOf(STX, i);
    if (start < 0) break;
    const end = buffer.indexOf(ETX, start + 1);
    if (end < 0) break; // quadro ainda incompleto
    const payload = buffer.slice(start + 1, end);
    // só dígitos = peso estável; qualquer letra (I/N/S) = não estável → ignora
    const m = payload.match(/^\D*(\d{5})\D*$/);
    if (m) grams = parseInt(m[1], 10); // 5 dígitos (2int+3dec kg) já são o peso em gramas
    i = end + 1;
  }
  return grams;
}
