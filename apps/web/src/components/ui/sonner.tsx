import { Toaster as Sonner } from 'sonner';
import { useTheme } from '../theme-provider';
export const Toaster = () => {
  const { theme } = useTheme();
  return (
    <Sonner
      richColors
      closeButton
      position="bottom-right"
      theme={theme}
      toastOptions={{ style: { fontFamily: 'var(--font-sans)' } }}
    />
  );
};
