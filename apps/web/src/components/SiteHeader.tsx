import {
  type Category,
  categoryFromSlug,
  categorySlugs,
  locales,
} from "@choose/catalog";
import { Link, useLocation, useParams } from "@tanstack/react-router";
import { type MouseEvent, useEffect, useState } from "react";
import { css, cx } from "styled-system/css";
import { isPlainClick, useSceneNavigation } from "~/features/scene/navigation";
import { useLocale } from "~/i18n/locale";
import { messages as m } from "~/i18n/messages";
import { CategoryDrop } from "./CategoryDrop";
import { CategoryIcon } from "./CategoryIcon";

const link = css({
  fontSize: "sm",
  color: "ink.muted",
  px: "3",
  h: "8",
  // A finger needs a larger target than a pointer.
  _coarse: { h: "10", px: "3.5" },
  display: "inline-flex",
  alignItems: "center",
  borderRadius: "pill",
  transition: "color 160ms, background 160ms",
  _hover: { color: "ink" },
  "&[data-status=active]": {
    color: "ink",
    bg: "surface.raised",
    boxShadow: "0 0 0 1px token(colors.line)",
  },
});

/**
 * A category's link: its icon alone, its name said to screen readers and shown on hover. The
 * picked one's disc is the drop behind them all (CategoryDrop): its icon inks as the drop lands.
 */
const iconLink = css({
  position: "relative",
  display: "grid",
  placeItems: "center",
  w: "9",
  h: "9",
  borderRadius: "full",
  color: "ink.muted",
  transition: "color 160ms",
  _hover: { color: "ink" },
  _focusVisible: {
    outline: "2px solid",
    outlineColor: "signal",
    outlineOffset: "2px",
  },
  "&[data-picked]": { color: "ink", transitionDelay: "220ms" },
});

/** The name under the icon, a moment after the pointer settles on it (or at once on focus). */
const tip = css({
  position: "absolute",
  top: "calc(100% + 6px)",
  left: "50%",
  px: "2",
  py: "1",
  borderRadius: "pill",
  bg: "ink",
  color: "paper",
  fontFamily: "mono",
  fontSize: "2xs",
  lineHeight: "1",
  letterSpacing: "0.06em",
  textTransform: "uppercase",
  whiteSpace: "nowrap",
  pointerEvents: "none",
  opacity: 0,
  transform: "translate(-50%, -3px)",
  transition: "opacity 160ms, transform 220ms token(easings.signal)",
  "@media (hover: hover)": {
    _groupHover: {
      opacity: 1,
      transform: "translate(-50%, 0)",
      transitionDelay: "120ms",
    },
  },
  _groupFocusVisible: { opacity: 1, transform: "translate(-50%, 0)" },
  _motionReduce: { transition: "opacity 160ms" },
});

/** `shown`: the categories the site offers (those with products), in panel order. */
export function SiteHeader({ shown }: { shown: readonly Category[] }) {
  const locale = useLocale();
  const params = useParams({ strict: false }) as {
    category?: string;
    product?: string;
  };
  const { searchStr } = useLocation();
  const current = params.category
    ? categoryFromSlug(params.category, locale)
    : null;
  // The category picked shows as soon as it is clicked, ahead of its page; the page on screen
  // (back and forward included) has the last word.
  const [picked, setPicked] = useState(current);
  useEffect(() => setPicked(current), [current]);
  // Plain clicks go through the scene (the panel opens or folds back); modified clicks stay links.
  const sceneTo = useSceneNavigation();
  const via = (category: Category | null) => (e: MouseEvent) => {
    if (!isPlainClick(e)) return;
    e.preventDefault();
    setPicked(category);
    sceneTo(category);
  };

  return (
    <header
      className={css({
        position: "fixed",
        insetInline: "0",
        top: "0",
        zIndex: "20",
        display: "grid",
        gridTemplateColumns: "1fr auto 1fr",
        alignItems: "center",
        gap: "4",
        // Clear of the notch and the rounded corners of a phone (viewport-fit=cover).
        boxSizing: "content-box",
        h: "16",
        pt: "env(safe-area-inset-top)",
        pl: {
          base: "max(1rem, env(safe-area-inset-left))",
          md: "max(2rem, env(safe-area-inset-left))",
        },
        pr: {
          base: "max(1rem, env(safe-area-inset-right))",
          md: "max(2rem, env(safe-area-inset-right))",
        },
        pointerEvents: "none",
        "& > *": { pointerEvents: "auto" },
      })}
    >
      <Link
        to="/$lang"
        params={{ lang: locale }}
        onClick={via(null)}
        className={css({
          display: "inline-flex",
          alignItems: "center",
          gap: "2.5",
          justifySelf: "start",
        })}
      >
        <span
          aria-hidden
          className={css({
            w: "3",
            h: "3",
            borderRadius: "full",
            bg: "signal",
          })}
        />
        <span
          className={css({
            fontFamily: "mono",
            fontSize: "sm",
            letterSpacing: "-0.02em",
            whiteSpace: "nowrap",
          })}
        >
          {m.siteName[locale]}
        </span>
      </Link>

      <nav
        aria-label={m.categories[locale]}
        className={css({
          position: "relative",
          display: { base: "none", sm: "flex" },
          gap: "1.5",
        })}
      >
        <CategoryDrop at={picked ? shown.indexOf(picked) : -1} />
        {shown.map((category) => (
          <Link
            key={category}
            to="/$lang/$category/{-$product}"
            // The category itself, without the product of a sheet open on the page.
            params={{
              lang: locale,
              category: categorySlugs[category][locale],
              product: undefined,
            }}
            onClick={via(category)}
            aria-label={m.category[category][locale]}
            data-slot
            data-picked={category === picked || undefined}
            className={cx("group", iconLink)}
          >
            <CategoryIcon category={category} />
            <span aria-hidden className={tip}>
              {m.category[category][locale]}
            </span>
          </Link>
        ))}
      </nav>

      {/* Always in the last column, so it stays at the right when the categories are hidden. The
          other language keeps the page: the category, its answers and the product open. */}
      <nav
        aria-label={m.language[locale]}
        className={css({
          gridColumn: "3",
          justifySelf: "end",
          display: "flex",
          gap: "1",
        })}
      >
        {locales.map((other) => (
          <a
            key={other}
            href={
              current
                ? `/${other}/${categorySlugs[current][other]}${params.product ? `/${params.product}` : ""}${searchStr}`
                : `/${other}`
            }
            hrefLang={other}
            data-status={other === locale ? "active" : undefined}
            className={cx(
              link,
              css({
                fontFamily: "mono",
                textTransform: "uppercase",
                fontSize: "xs",
              }),
            )}
          >
            {other}
          </a>
        ))}
      </nav>
    </header>
  );
}
