export interface NumberPair {
  value: number;
  sino: string;
  sinoPron: string;
  native: string;
  nativeShort?: string;
  nativePron: string;
  usageTip?: string;
}

export const BASIC_NUMBERS: NumberPair[] = [
  { value: 1, sino: '일', sinoPron: 'il', native: '하나', nativeShort: '한', nativePron: 'hana (han)', usageTip: '한 시 (la 1:00) / 한 개 (1 unidad)' },
  { value: 2, sino: '이', sinoPron: 'i', native: '둘', nativeShort: '두', nativePron: 'dul (du)', usageTip: '두 시 (las 2:00) / 두 명 (2 personas)' },
  { value: 3, sino: '삼', sinoPron: 'sam', native: '셋', nativeShort: '세', nativePron: 'set (se)', usageTip: '세 시 (las 3:00) / 세 살 (3 años)' },
  { value: 4, sino: '사', sinoPron: 'sa', native: '넷', nativeShort: '네', nativePron: 'net (ne)', usageTip: '네 시 (las 4:00)' },
  { value: 5, sino: '오', sinoPron: 'o', native: '다섯', nativeShort: '다섯', nativePron: 'daseot', usageTip: '다섯 시 (las 5:00)' },
  { value: 6, sino: '육', sinoPron: 'yuk', native: '여섯', nativeShort: '여섯', nativePron: 'yeoseot', usageTip: '여섯 시 (las 6:00)' },
  { value: 7, sino: '칠', sinoPron: 'chil', native: '일곱', nativeShort: '일곱', nativePron: 'ilgop', usageTip: '일곱 시 (las 7:00)' },
  { value: 8, sino: '팔', sinoPron: 'pal', native: '여덟', nativeShort: '여덟', nativePron: 'yeodeol', usageTip: '여덟 시 (las 8:00)' },
  { value: 9, sino: '구', sinoPron: 'gu', native: '아홉', nativeShort: '아홉', nativePron: 'ahop', usageTip: '아홉 시 (las 9:00)' },
  { value: 10, sino: '십', sinoPron: 'sip', native: '열', nativeShort: '열', nativePron: 'yeol', usageTip: '열 시 (las 10:00)' },
  { value: 11, sino: '십일', sinoPron: 'sibil', native: '열하나', nativeShort: '열한', nativePron: 'yeolhana (yeolhan)', usageTip: '열한 시 (las 11:00)' },
  { value: 12, sino: '십이', sinoPron: 'sibi', native: '열둘', nativeShort: '열두', nativePron: 'yeoldul (yeoldu)', usageTip: '열두 시 (las 12:00)' },
];

export const SINO_TENS: { value: number; sino: string; sinoPron: string }[] = [
  { value: 10, sino: '십', sinoPron: 'sip' },
  { value: 20, sino: '이십', sinoPron: 'isip' },
  { value: 30, sino: '삼십', sinoPron: 'samsip' },
  { value: 40, sino: '사십', sinoPron: 'sasip' },
  { value: 50, sino: '오십', sinoPron: 'osip' },
  { value: 60, sino: '육십', sinoPron: 'yuksip' },
  { value: 100, sino: '백', sinoPron: 'baek' },
  { value: 1000, sino: '천', sinoPron: 'cheon' },
  { value: 10000, sino: '만', sinoPron: 'man' },
];

// Helper to convert number 0-59 to Sino-Korean
export function numberToSino(n: number): string {
  if (n === 0) return '영';
  const digits = ['', '일', '이', '삼', '사', '오', '육', '칠', '팔', '구'];
  if (n < 10) return digits[n];
  const tens = Math.floor(n / 10);
  const ones = n % 10;
  const tensPart = tens === 1 ? '십' : `${digits[tens]}십`;
  const onesPart = ones === 0 ? '' : digits[ones];
  return `${tensPart}${onesPart}`;
}

export const HOUR_NATIVE: Record<number, string> = {
  1: '한 시',
  2: '두 시',
  3: '세 시',
  4: '네 시',
  5: '다섯 시',
  6: '여섯 시',
  7: '일곱 시',
  8: '여덟 시',
  9: '아홉 시',
  10: '열 시',
  11: '열한 시',
  12: '열두 시',
};

export function formatKoreanTime(hour: number, minute: number): {
  koreanText: string;
  hourPart: string;
  minutePart: string;
  spanishText: string;
} {
  const safeHour = hour < 1 || hour > 12 ? 1 : hour;
  const hourPart = HOUR_NATIVE[safeHour] ?? '한 시';

  let minutePart = '';
  if (minute === 0) {
    minutePart = '정각 (En punto)';
  } else if (minute === 30) {
    minutePart = '삼십 분 (o 반 - y media)';
  } else {
    minutePart = `${numberToSino(minute)} 분 (Sino)`;
  }

  const koreanText = minute === 0 ? hourPart : `${hourPart} ${numberToSino(minute)} 분`;

  const spanishHour = safeHour === 1 ? 'la una' : `las ${safeHour}`;
  let spanishMinute = '';
  if (minute === 0) spanishMinute = ' en punto';
  else if (minute === 30) spanishMinute = ' y media';
  else if (minute === 15) spanishMinute = ' y cuarto';
  else spanishMinute = ` y ${minute}`;

  return {
    koreanText,
    hourPart: `${hourPart} (Nativo)`,
    minutePart,
    spanishText: `Son ${spanishHour}${spanishMinute}`,
  };

}

export interface DayOfWeek {
  korean: string;
  spanish: string;
  hanjaMeaning: string;
  iconName: string;
}

export const DAYS_OF_WEEK: DayOfWeek[] = [
  { korean: '월요일', spanish: 'Lunes', hanjaMeaning: '월 (月 - Luna)', iconName: 'Moon' },
  { korean: '화요일', spanish: 'Martes', hanjaMeaning: '화 (火 - Fuego)', iconName: 'Flame' },
  { korean: '수요일', spanish: 'Miércoles', hanjaMeaning: '수 (水 - Agua)', iconName: 'Droplet' },
  { korean: '목요일', spanish: 'Jueves', hanjaMeaning: '목 (木 - Árbol/Madera)', iconName: 'Trees' },
  { korean: '금요일', spanish: 'Viernes', hanjaMeaning: '금 (金 - Oro/Metal)', iconName: 'Coins' },
  { korean: '토요일', spanish: 'Sábado', hanjaMeaning: '토 (土 - Tierra)', iconName: 'Mountain' },
  { korean: '일요일', spanish: 'Domingo', hanjaMeaning: '일 (日 - Sol)', iconName: 'Sun' },
];

export interface GrammarCapsule {
  questionWord: string;
  meaning: string;
  particleNote: string;
  exampleKorean: string;
  exampleSpanish: string;
  audioText: string;
}

export const GRAMMAR_CAPSULES: GrammarCapsule[] = [
  {
    questionWord: '누구',
    meaning: '¿Quién?',
    particleNote: 'Suele acompañarse de la partícula de tema 은/는',
    exampleKorean: '이 사람은 누구예요?',
    exampleSpanish: '¿Quién es esta persona?',
    audioText: '이 사람은 누구예요?',
  },
  {
    questionWord: '어디',
    meaning: '¿Dónde?',
    particleNote: 'Usa la partícula de ubicación 에 (en / a) + 있어요 (está)',
    exampleKorean: '필통이 어디에 있어요?',
    exampleSpanish: '¿Dónde está la cartuchera?',
    audioText: '필통이 어디에 있어요?',
  },
  {
    questionWord: '뭐 / 무엇',
    meaning: '¿Qué?',
    particleNote: 'Partícula de sujeto 이/가 o pregunta directa',
    exampleKorean: '저것은 뭐예요?',
    exampleSpanish: '¿Qué es eso?',
    audioText: '저것은 뭐예요?',
  },
  {
    questionWord: '무엇을 / 뭐 / 뭘',
    meaning: '¿Qué...? (con acción)',
    particleNote: 'Lleva la partícula de objeto directo 을/를 con verbos de acción',
    exampleKorean: '뭐 먹어요? (o 무엇을 먹어요?)',
    exampleSpanish: '¿Qué comes?',
    audioText: '뭐 먹어요?',
  },
  {
    questionWord: '무슨',
    meaning: '¿Qué clase de...?',
    particleNote: 'Va SIEMPRE seguido de un sustantivo para especificar en detalle',
    exampleKorean: '무슨 음식을 좋아해요?',
    exampleSpanish: '¿Qué comida te gusta?',
    audioText: '무슨 음식을 좋아해요?',
  },
  {
    questionWord: '몇',
    meaning: '¿Qué número / Cuántos?',
    particleNote: 'Va seguido de contadores sino-coreanos (층 = piso, 쪽 = pág, 번 = núm, 시 = hora)',
    exampleKorean: '몇 층이에요? / 몇 쪽이에요? / 몇 시예요?',
    exampleSpanish: '¿Qué piso es? / ¿Qué página es? / ¿Qué hora es?',
    audioText: '몇 층이에요?',
  },
];

// --- NÚMEROS NATIVOS COREANOS COMPLETOS (고유어 수사) ---
export interface NativeNumberItem {
  value: number;
  hangul: string;
  shortForm?: string;
  pronunciation: string;
  spanish: string;
  audioText: string;
  tip?: string;
}

export const NATIVE_NUMBERS_FULL: NativeNumberItem[] = [
  { value: 1, hangul: '하나', shortForm: '한', pronunciation: 'ha-na / han', spanish: 'Uno (1)', audioText: '하나, 한', tip: '한 개 (1 cosa) / 한 시 (la 1:00)' },
  { value: 2, hangul: '둘', shortForm: '두', pronunciation: 'dul / du', spanish: 'Dos (2)', audioText: '둘, 두', tip: '두 명 (2 personas) / 두 시 (las 2:00)' },
  { value: 3, hangul: '셋', shortForm: '세', pronunciation: 'set / se', spanish: 'Tres (3)', audioText: '셋, 세', tip: '세 살 (3 años) / 세 시 (las 3:00)' },
  { value: 4, hangul: '넷', shortForm: '네', pronunciation: 'net / ne', spanish: 'Cuatro (4)', audioText: '넷, 네', tip: '네 마리 (4 animales) / 네 시 (las 4:00)' },
  { value: 5, hangul: '다섯', pronunciation: 'da-seot', spanish: 'Cinco (5)', audioText: '다섯' },
  { value: 6, hangul: '여섯', pronunciation: 'yeo-seot', spanish: 'Seis (6)', audioText: '여섯' },
  { value: 7, hangul: '일곱', pronunciation: 'il-gop', spanish: 'Siete (7)', audioText: '일곱' },
  { value: 8, hangul: '여덟', pronunciation: 'yeo-deol', spanish: 'Ocho (8)', audioText: '여덟' },
  { value: 9, hangul: '아홉', pronunciation: 'a-hop', spanish: 'Nueve (9)', audioText: '아홉' },
  { value: 10, hangul: '열', pronunciation: 'yeol', spanish: 'Diez (10)', audioText: '열' },
  { value: 11, hangul: '열하나', shortForm: '열한', pronunciation: 'yeol-ha-na', spanish: 'Once (11)', audioText: '열하나, 열한', tip: '열한 시 (las 11:00)' },
  { value: 12, hangul: '열둘', shortForm: '열두', pronunciation: 'yeol-dul', spanish: 'Doce (12)', audioText: '열둘, 열두', tip: '열두 시 (las 12:00)' },
  { value: 20, hangul: '스물', shortForm: '스무', pronunciation: 'seu-mul / seu-mu', spanish: 'Veinte (20)', audioText: '스물, 스무', tip: '스무 살 (20 años) / 스무 개 (20 cosas)' },
  { value: 30, hangul: '서른', pronunciation: 'seo-reun', spanish: 'Treinta (30)', audioText: '서른' },
  { value: 40, hangul: '마흔', pronunciation: 'ma-heun', spanish: 'Cuarenta (40)', audioText: '마흔' },
  { value: 50, hangul: '쉰', pronunciation: 'shwin', spanish: 'Cincuenta (50)', audioText: '쉰' },
  { value: 60, hangul: '예순', pronunciation: 'ye-sun', spanish: 'Sesenta (60)', audioText: '예순' },
  { value: 70, hangul: '일흔', pronunciation: 'il-heun', spanish: 'Setenta (70)', audioText: '일흔' },
  { value: 80, hangul: '여든', pronunciation: 'yeo-deun', spanish: 'Ochenta (80)', audioText: '여든' },
  { value: 90, hangul: '아흔', pronunciation: 'a-heun', spanish: 'Noventa (90)', audioText: '아흔' },
  { value: 100, hangul: '백', pronunciation: 'baek', spanish: 'Cien (100) (número de origen sino-coreano)', audioText: '백', tip: 'Para 100 se usa el número de origen sino-coreano (백)' },
];

// --- DÍAS DEL MES (일) 1~31 ---
export interface MonthDayItem {
  day: number;
  hangul: string;
  pronunciation: string;
  spanish: string;
  note?: string;
}

export const MONTH_DAYS: MonthDayItem[] = [
  { day: 1, hangul: '일일', pronunciation: 'i-ril', spanish: 'Día 1' },
  { day: 2, hangul: '이일', pronunciation: 'i-il', spanish: 'Día 2' },
  { day: 3, hangul: '삼일', pronunciation: 'sa-mil', spanish: 'Día 3' },
  { day: 4, hangul: '사일', pronunciation: 'sa-il', spanish: 'Día 4' },
  { day: 5, hangul: '오일', pronunciation: 'o-il', spanish: 'Día 5' },
  { day: 6, hangul: '육일', pronunciation: 'yu-gil', spanish: 'Día 6' },
  { day: 7, hangul: '칠일', pronunciation: 'chi-ril', spanish: 'Día 7' },
  { day: 8, hangul: '팔일', pronunciation: 'pa-ril', spanish: 'Día 8' },
  { day: 9, hangul: '구일', pronunciation: 'gu-il', spanish: 'Día 9' },
  { day: 10, hangul: '십일', pronunciation: 'shi-bil', spanish: 'Día 10' },
  { day: 11, hangul: '십일일', pronunciation: 'shi-bi-ril', spanish: 'Día 11' },
  { day: 12, hangul: '십이일', pronunciation: 'shi-bi-il', spanish: 'Día 12' },
  { day: 13, hangul: '십삼일', pronunciation: 'ship-sam-il', spanish: 'Día 13' },
  { day: 14, hangul: '십사일', pronunciation: 'ship-sa-il', spanish: 'Día 14' },
  { day: 15, hangul: '십오일', pronunciation: 'ship-o-il', spanish: 'Día 15' },
  { day: 16, hangul: '십육일', pronunciation: 'shim-nyu-gil', spanish: 'Día 16', note: 'Asimilación: 십육일 → [심뉴길]' },
  { day: 17, hangul: '십칠일', pronunciation: 'ship-chi-ril', spanish: 'Día 17' },
  { day: 18, hangul: '십팔일', pronunciation: 'ship-pa-ril', spanish: 'Día 18' },
  { day: 19, hangul: '십구일', pronunciation: 'ship-gu-il', spanish: 'Día 19' },
  { day: 20, hangul: '이십일', pronunciation: 'i-shi-bil', spanish: 'Día 20' },
  { day: 21, hangul: '이십일일', pronunciation: 'i-shi-bi-ril', spanish: 'Día 21' },
  { day: 22, hangul: '이십이일', pronunciation: 'i-shi-bi-il', spanish: 'Día 22' },
  { day: 23, hangul: '이십삼일', pronunciation: 'i-ship-sam-il', spanish: 'Día 23' },
  { day: 24, hangul: '이십사일', pronunciation: 'i-ship-sa-il', spanish: 'Día 24' },
  { day: 25, hangul: '이십오일', pronunciation: 'i-ship-o-il', spanish: 'Día 25' },
  { day: 26, hangul: '이십육일', pronunciation: 'i-shim-nyu-gil', spanish: 'Día 26', note: 'Asimilación: 이십육일 → [이심뉴길]' },
  { day: 27, hangul: '이십칠일', pronunciation: 'i-ship-chi-ril', spanish: 'Día 27' },
  { day: 28, hangul: '이십팔일', pronunciation: 'i-ship-pa-ril', spanish: 'Día 28' },
  { day: 29, hangul: '이십구일', pronunciation: 'i-ship-gu-il', spanish: 'Día 29' },
  { day: 30, hangul: '삼십일', pronunciation: 'sam-shi-bil', spanish: 'Día 30' },
  { day: 31, hangul: '삼십일일', pronunciation: 'sam-shi-bi-ril', spanish: 'Día 31' },
];

