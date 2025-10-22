export type EOL = '\n' | '\r\n';

export function detectEOL(text: string): EOL {
    const hasCRLF = /\r\n/.test(text);
    return hasCRLF ? '\r\n' : '\n';
}

export function normalizeTo(text: string, eol: EOL): string {
    if (eol === '\n') return text.replace(/\r\n/g, '\n');
    // to CRLF
    return text.replace(/(?<!\r)\n/g, '\r\n');
}