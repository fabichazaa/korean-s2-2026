<template>
  <div class="nuri-page min-h-[100dvh]">
    <div class="mx-auto flex min-h-[100dvh] max-w-[1440px]">
      <div class="w-full px-5 py-8 sm:px-8 md:px-12 lg:px-16">
        <div class="nuri-skeleton h-7 w-32 rounded-full" />
        <div class="mt-20 h-5 w-32 rounded-full nuri-skeleton" />
        <div class="mt-5 h-20 max-w-[530px] rounded-xl nuri-skeleton" />
        <div class="mt-10 h-[430px] w-full rounded-[26px] nuri-skeleton" />
      </div>
    </div>
  </div>
</template>

<style scoped>
.min-h-\[100dvh\] { min-height: 100vh; min-height: 100dvh; }
.max-w-\[1440px\] { max-width: 1440px; }
.max-w-\[530px\] { max-width: 530px; }
.w-full { width: 100%; }
.w-32 { width: 8rem; }
.h-5 { height: 1.25rem; }
.h-7 { height: 1.75rem; }
.h-20 { height: 5rem; }
.h-\[430px\] { height: 430px; }
.rounded-full { border-radius: 9999px; }
.rounded-xl { border-radius: 0.75rem; }
.rounded-\[26px\] { border-radius: 26px; }
.mx-auto { margin-left: auto; margin-right: auto; }
.mt-5 { margin-top: 1.25rem; }
.mt-10 { margin-top: 2.5rem; }
.mt-20 { margin-top: 5rem; }
.px-5 { padding-left: 1.25rem; padding-right: 1.25rem; }
.py-8 { padding-top: 2rem; padding-bottom: 2rem; }
.flex { display: flex; }

@media (min-width: 640px) {
  .sm\:px-8 { padding-left: 2rem !important; padding-right: 2rem !important; }
}
@media (min-width: 768px) {
  .md\:px-12 { padding-left: 3rem !important; padding-right: 3rem !important; }
}
@media (min-width: 1024px) {
  .lg\:px-16 { padding-left: 4rem !important; padding-right: 4rem !important; }
}
</style>
