
import React from 'react';
import { cn } from '../lib/utils';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'link';
  size?: 'sm' | 'md' | 'lg';
  fullWidth?: boolean;
  glow?: boolean;
  children: React.ReactNode;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', fullWidth = false, glow = false, children, ...props }, ref) => {
    const baseStyles = 'inline-flex items-center justify-center rounded-md font-medium transition-all focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none';
    
    const variantStyles = {
      primary: 'bg-neon-pink hover:bg-opacity-90 text-white',
      secondary: 'bg-secondary hover:bg-opacity-80 text-foreground',
      outline: 'border border-neon-pink bg-transparent hover:bg-neon-pink hover:bg-opacity-10 text-neon-pink',
      ghost: 'bg-transparent hover:bg-neon-pink hover:bg-opacity-10 text-neon-pink',
      link: 'bg-transparent underline-offset-4 hover:underline text-neon-pink p-0'
    };
    
    const sizeStyles = {
      sm: 'h-8 px-3 text-xs',
      md: 'h-10 px-4 text-sm',
      lg: 'h-12 px-6 text-base'
    };
    
    const glowStyles = glow ? 'animate-pulse-glow' : '';
    const widthStyles = fullWidth ? 'w-full' : '';
    
    return (
      <button
        className={cn(
          baseStyles,
          variantStyles[variant],
          sizeStyles[size],
          widthStyles,
          glowStyles,
          className
        )}
        ref={ref}
        {...props}
      >
        {children}
      </button>
    );
  }
);

Button.displayName = 'Button';

export default Button;
