import { cn } from '@/lib/utils';

interface BracketedProps {
  children: React.ReactNode;
  className?: string;
  corners?: 2 | 4;
  as?: keyof JSX.IntrinsicElements;
}

export function Bracketed({ children, className, corners = 2, as = 'div' }: BracketedProps) {
  const Tag = as as 'div';
  return (
    <Tag className={cn(corners === 4 ? 'bracketed bracketed-4' : 'bracketed', className)}>
      {corners === 4 && (
        <>
          <span className="br-tr" />
          <span className="br-bl" />
        </>
      )}
      {children}
    </Tag>
  );
}
