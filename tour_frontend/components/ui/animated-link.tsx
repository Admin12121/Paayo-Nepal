import type { ComponentPropsWithoutRef, ReactNode } from "react";
import NextLink, { type LinkProps } from "next/link";
import FlipText from "@/components/ui/flip-text";

type AnchorProps = Omit<ComponentPropsWithoutRef<"a">, "href">;

type AnimatedLinkProps = LinkProps &
  AnchorProps & {
    children: ReactNode;
    disableFlip?: boolean;
    flipClassName?: string;
  };

function canFlip(children: ReactNode): children is string {
  return typeof children === "string" && children.trim().length > 0;
}

export default function Link({
  children,
  disableFlip = false,
  flipClassName,
  ...props
}: AnimatedLinkProps) {
  if (!disableFlip && canFlip(children)) {
    return (
      <NextLink {...props}>
        <FlipText as="span" className={flipClassName}>
          {children}
        </FlipText>
      </NextLink>
    );
  }

  return <NextLink {...props}>{children}</NextLink>;
}
