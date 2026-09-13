import { useEffect, useState } from 'react';
import {
  CircleCheckIcon,
  InfoIcon,
  Loader2Icon,
  OctagonXIcon,
  TriangleAlertIcon,
} from 'lucide-react';
import { Toaster as Sonner, type ToasterProps } from 'sonner';

/*
 * The registry file reads the theme from `next-themes`. Starlight owns the
 * toggle here and writes `data-theme` on the document element, so the
 * dependency is replaced by a subscription to that attribute; everything else
 * is the generated component.
 */
function useDocumentTheme(): ToasterProps['theme'] {
  const [theme, setTheme] = useState<ToasterProps['theme']>('dark');

  useEffect(() => {
    const root = document.documentElement;
    const read = () =>
      setTheme(root.dataset.theme === 'light' ? 'light' : 'dark');
    const observer = new MutationObserver(read);
    observer.observe(root, { attributeFilter: ['data-theme'] });
    read();
    return () => observer.disconnect();
  }, []);

  return theme;
}

const Toaster = ({ ...props }: ToasterProps) => {
  const theme = useDocumentTheme();

  return (
    <Sonner
      theme={theme}
      className="toaster group"
      icons={{
        success: <CircleCheckIcon className="size-4" />,
        info: <InfoIcon className="size-4" />,
        warning: <TriangleAlertIcon className="size-4" />,
        error: <OctagonXIcon className="size-4" />,
        loading: <Loader2Icon className="size-4 animate-spin" />,
      }}
      style={
        {
          '--normal-bg': 'var(--popover)',
          '--normal-text': 'var(--popover-foreground)',
          '--normal-border': 'var(--border)',
          '--border-radius': 'var(--radius)',
        } as React.CSSProperties
      }
      {...props}
    />
  );
};

export { Toaster };
