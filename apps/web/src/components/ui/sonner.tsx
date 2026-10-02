import { Toaster as Sonner } from 'sonner';
export const Toaster = () => (
  <Sonner
    richColors
    closeButton
    position="bottom-right"
    theme="light"
    toastOptions={{ style: { fontFamily: 'var(--font-sans)' } }}
  />
);
