export function speakKorean(text: string): void {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
    return;
  }
  
  try {
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'ko-KR';
    utterance.rate = 0.88; // Slower rate for clear language learning pronunciation
    
    const voices = window.speechSynthesis.getVoices();
    const koreanVoice = voices.find((v) => v.lang.toLowerCase().includes('ko'));
    if (koreanVoice) {
      utterance.voice = koreanVoice;
    }
    
    window.speechSynthesis.speak(utterance);
  } catch (err) {
    console.warn('Speech synthesis not available or error occurred:', err);
  }
}
