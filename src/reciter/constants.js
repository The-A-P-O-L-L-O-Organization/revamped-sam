// Character-classification bits of the reciter's character flag table
// (tab36376 in the original address space). The bit values are verified
// against the rule-condition checks in the 6502 reciter code, which AND
// table entries against these bits to test the text around a rule match
// (vowel-or-Y 0x40 pos36910, voiced 0x08 pos36920, sibilant 0x10 pos36935,
// yod-dropping 0x04 pos36967, consonant 0x20 pos37004).
export const FLAG_NUMERIC       = 0x01; // digits: matched by the '.' handling at pos36579 ('4.2', ...)
export const FLAG_RULESET2      = 0x02; // punctuation routed to the rules2 table at pos36607
export const FLAG_YOD_DROPPING  = 0x04; // D, G, J, L, N, R, S, T, Z ('@' condition): the letters
                                        // before which orthographic U/EW is read /u:/ without a /j/
                                        // glide (cf. rules @(U), @(EW), @(UR)#)
export const FLAG_VOICED        = 0x08; // voiced consonants: B, D, G, J, L, M, N, R, V, W, Z
                                        // ('.' condition; drives e.g. .E(D) -> D, .(S) -> Z)
export const FLAG_SIBILANT      = 0x10; // sibilant-forming letters: C, S, X ('&' condition; the
                                        // CH/SH digraphs are checked by the caller besides this flag)
export const FLAG_CONSONANT     = 0x20; // consonants ('^' condition)
export const FLAG_VOWEL_OR_Y    = 0x40; // vowels and 'Y' ('#' condition)
export const FLAG_ALPHA_OR_QUOT = 0x80; // alphabet characters and the quotation mark
