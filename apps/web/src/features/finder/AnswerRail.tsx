import { useRef } from "react";
import { css } from "styled-system/css";
import { chip } from "styled-system/recipes";
import { gsap, prefersReducedMotion, useGSAP } from "../motion/gsap";
import { motion } from "../motion/tokens";

// The answers given so far, as a path of chips. A chip reopens its question.

type Props = {
  items: { key: string; label: string; value: string }[];
  current: string | null;
  onPick: (key: string) => void;
};

export function AnswerRail({ items, current, onPick }: Props) {
  const root = useRef<HTMLOListElement>(null);
  const count = useRef(items.length);

  useGSAP(
    () => {
      const grew = items.length > count.current;
      count.current = items.length;
      if (!grew || prefersReducedMotion()) return;
      gsap.from(root.current?.lastElementChild ?? [], {
        opacity: 0,
        x: -12,
        scale: 0.9,
        duration: motion.base,
        ease: motion.ease,
      });
    },
    { dependencies: [items.length], scope: root },
  );

  if (!items.length) return null;
  return (
    <ol
      ref={root}
      className={css({
        display: "flex",
        flexWrap: { base: "nowrap", md: "wrap" },
        overflowX: { base: "auto", md: "visible" },
        scrollbarWidth: "none",
        alignItems: "center",
        rowGap: "2",
        mx: { base: "-4", md: "0" },
        px: { base: "4", md: "0" },
        // The rest of the stage lets the pointer through to the canvas; the chips take it.
        pointerEvents: "auto",
      })}
    >
      {items.map((item, i) => (
        <li
          key={item.key}
          className={css({
            display: "flex",
            alignItems: "center",
            flexShrink: "0",
          })}
        >
          {i > 0 && (
            <span
              aria-hidden
              className={css({ w: "3", h: "1px", bg: "line.strong" })}
            />
          )}
          <button
            type="button"
            onClick={() => onPick(item.key)}
            className={chip()}
            data-current={item.key === current || undefined}
            style={
              item.key === current
                ? { borderColor: "var(--colors-signal)" }
                : undefined
            }
          >
            <span
              className={css({
                fontFamily: "mono",
                fontSize: "2xs",
                color: "ink.faint",
                textTransform: "uppercase",
              })}
            >
              {item.label}
            </span>
            <span>{item.value}</span>
          </button>
        </li>
      ))}
    </ol>
  );
}
