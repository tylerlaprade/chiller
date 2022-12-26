import { Dialog } from '@headlessui/react'
import clsx from 'clsx'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { objectify, sift, unique } from 'radash'
import { ChangeEventHandler, forwardRef, ReactNode, Ref, useRef } from 'react'
import { useHotkeys } from 'react-hotkeys-hook'
import { SearchButton } from 'src/components/Search'
import config from 'src/config'
import { useActionKey } from 'src/hooks/useActionKey'
import { useIsomorphicLayoutEffect } from 'src/hooks/useIsomorphicLayoutEffect'
import { nav } from 'src/nav'
import { SidebarContext, useSearch, useVersioning } from 'src/state'
import type { Nav } from 'src/types'
import { twMerge } from 'tailwind-merge'

const NavItem = forwardRef(
  (
    {
      href,
      children,
      isActive,
      isPublished,
      fallbackHref
    }: {
      href: string
      children: ReactNode
      isActive: boolean
      isPublished: boolean
      fallbackHref: string
    },
    ref: Ref<any>
  ) => {
    return (
      <li
        ref={ref}
        data-active={isActive ? 'true' : undefined}
      >
        <Link href={isPublished ? href : fallbackHref}>
          <a
            data-is-selected={isActive ? 'true' : 'false'}
            className={twMerge(
              'block border-l pl-4 -ml-px border-transparent hover:border-slate-400 dark:hover:border-slate-500 data-selected:text-sky-500 data-selected:border-sky-500 data-selected:font-semibold data-selected:dark:text-sky-400 data-selected:dark:border-sky-400',
              config.theme?.['sidebar.group.link'] ?? ''
            )}
          >
            {children}
          </a>
        </Link>
      </li>
    )
  }
)

/**
 * Find the nearst scrollable ancestor (or self if scrollable)
 *
 * Code adapted and simplified from the smoothscroll polyfill
 *
 *
 * @param {Element} el
 */
function nearestScrollableContainer(el?: Element) {
  /**
   * indicates if an element can be scrolled
   *
   * @param {Node} el
   */
  function isScrollable(el: any) {
    const style = window.getComputedStyle(el)
    const overflowX = style['overflowX']
    const overflowY = style['overflowY']
    const canScrollY = el.clientHeight < el.scrollHeight
    const canScrollX = el.clientWidth < el.scrollWidth

    const isScrollableY =
      canScrollY && (overflowY === 'auto' || overflowY === 'scroll')
    const isScrollableX =
      canScrollX && (overflowX === 'auto' || overflowX === 'scroll')

    return isScrollableY || isScrollableX
  }

  while (el !== document.body && isScrollable(el) === false) {
    el = el?.parentNode || (el as any).host
  }

  return el
}

function Nav({
  fallbackHref,
  mobile = false
}: {
  fallbackHref?: string
  mobile?: boolean
}) {
  const router = useRouter()
  const activeItemRef = useRef<any>()
  const previousActiveItemRef = useRef<any>()
  const scrollRef = useRef<any>()
  const { filter } = useSearch()
  const { version } = useVersioning()

  useIsomorphicLayoutEffect(() => {
    if (activeItemRef.current) {
      previousActiveItemRef.current = activeItemRef.current
      if (activeItemRef.current === previousActiveItemRef.current) {
        return
      }

      const scrollable = nearestScrollableContainer(scrollRef?.current)

      const scrollRect = scrollable?.getBoundingClientRect()
      const activeItemRect = activeItemRef.current.getBoundingClientRect()

      const top = activeItemRef.current?.offsetTop
      const bottom = top - scrollRect!.height + activeItemRect.height

      if (scrollable!.scrollTop > top || scrollable!.scrollTop < bottom) {
        scrollable!.scrollTop =
          top - scrollRect!.height / 2 + activeItemRect.height / 2
      }
    }
  }, [router.pathname])

  const navigation = nav(version ?? 'default')

  const filtered = (n: Nav) => {
    const allPages = Object.values(n).flat()
    const f = filter.trim().toLowerCase()
    const matchPages = allPages.filter(p => {
      return sift([p.meta.title, p.meta.description])
        .join(' ')
        .toLowerCase()
        .includes(f)
    })
    const groups = config.sidebar?.order
      ? (config.sidebar.order.filter(g =>
          matchPages.find(p => p.meta.group === g)
        ) as string[])
      : unique(sift(matchPages.map(p => p.meta.group)))
    return {
      pages: objectify(
        groups,
        g => g,
        g => matchPages.filter(p => p.meta.group === g)
      ),
      groups
    }
  }

  const filteredNav = filtered(navigation)

  return (
    <nav
      ref={scrollRef}
      id="nav"
      className="lg:text-sm lg:leading-6 relative"
    >
      <div className="sticky top-0 -ml-0.5 pointer-events-none">
        <div className="bg-white my-8 dark:bg-slate-900 relative pointer-events-auto">
          <DynamicSearchButton />
        </div>
      </div>
      <ul>
        <TopLevelNav mobile={mobile} />
        {filteredNav.groups
          .map(group => {
            const filteredPages = filteredNav.pages[group]
            return (
              <li
                key={group}
                className="mt-12 lg:mt-8"
              >
                <h5
                  className={clsx('mb-8 lg:mb-3 font-semibold', {
                    'text-slate-900 dark:text-slate-200':
                      filteredPages.length > 0,
                    'text-slate-400': filteredPages.length === 0
                  })}
                >
                  {group}
                </h5>
                <ul
                  className={clsx(
                    'space-y-6 lg:space-y-2 border-l border-slate-100',
                    mobile ? 'dark:border-slate-700' : 'dark:border-slate-800'
                  )}
                >
                  {filteredPages.map((item, i) => {
                    const isActive = item.meta.match
                      ? new RegExp(item.meta.match).test(router.pathname)
                      : item.href === router.pathname
                    return (
                      <NavItem
                        key={i}
                        href={item.href}
                        isActive={isActive}
                        ref={isActive ? activeItemRef : undefined}
                        isPublished={item.meta.published !== 'false'}
                        fallbackHref={fallbackHref ?? ''}
                      >
                        {item.meta.title}
                      </NavItem>
                    )
                  })}
                </ul>
              </li>
            )
          })
          .filter(Boolean)}
      </ul>
    </nav>
  )
}

const DynamicSearchButton = () => {
  const actionKey = useActionKey()
  const ref = useRef<HTMLInputElement | null>(null)
  const focus = () => ref.current?.focus()
  useHotkeys('Meta+k', focus)
  const { setFilter } = useSearch()
  const handleChange: ChangeEventHandler<HTMLInputElement> = e => {
    setFilter(e.target.value ?? '')
  }
  if (config.algolia)
    return (
      <SearchButton className="hidden w-full lg:flex items-center text-sm leading-6 text-slate-400 rounded-md ring-1 ring-slate-900/10 shadow-sm py-1.5 pl-2 pr-3 hover:ring-slate-300 dark:bg-slate-800 dark:highlight-white/5 dark:hover:bg-slate-700">
        {() => (
          <>
            <svg
              width="24"
              height="24"
              fill="none"
              aria-hidden="true"
              className="mr-3 flex-none"
            >
              <path
                d="m19 19-3.5-3.5"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <circle
                cx="11"
                cy="11"
                r="6"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            Quick search...
            {actionKey && (
              <span className="ml-auto pl-3 flex-none text-xs font-semibold">
                {actionKey[0]}K
              </span>
            )}
          </>
        )}
      </SearchButton>
    )
  return (
    <div
      onClick={focus}
      className="relative w-full flex items-center"
    >
      <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
        <svg
          width="24"
          height="24"
          fill="none"
          aria-hidden="true"
          className="mr-3 flex-none"
        >
          <path
            d="m19 19-3.5-3.5"
            strokeWidth="2"
            className="stroke-slate-400"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <circle
            cx="11"
            cy="11"
            r="6"
            strokeWidth="2"
            className="stroke-slate-400"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>
      <input
        className="pl-10 p-2.5 grow w-full rounded border border-slate-200 hover:border-slate-300"
        type="text"
        ref={ref}
        onChange={handleChange}
        placeholder="Quick search..."
      />
      {actionKey && (
        <div className="absolute inset-y-0 right-0 flex items-center pr-3">
          <span className="ml-auto pl-3 flex-none text-xs font-semibold text-slate-400">
            {actionKey[0]}K
          </span>
        </div>
      )}
    </div>
  )
}

const TopLevelAnchor = forwardRef(
  (
    {
      children,
      href,
      className,
      icon,
      isActive,
      onClick,
      mobile
    }: {
      children: ReactNode
      href: string
      className: string
      icon: string
      isActive: boolean
      onClick?: () => void
      mobile: boolean
    },
    ref
  ) => {
    return (
      <li>
        <a
          ref={ref as any}
          href={href}
          onClick={onClick}
          data-is-selected={isActive ? 'true' : 'false'}
          className={clsx(
            'group flex items-center lg:text-sm lg:leading-6',
            className,
            twMerge(
              'data-selected:font-semibold data-selected:text-sky-500 data-selected:dark:text-sky-400 font-medium text-slate-700 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-300',
              config.theme?.['sidebar.link'] ?? ''
            )
          )}
        >
          <div
            data-is-selected={isActive ? 'true' : 'false'}
            className={twMerge(
              clsx(
                'mr-4 rounded-md ring-1 ring-slate-900/5 shadow-sm group-hover:shadow group-hover:ring-slate-900/10 dark:ring-0 dark:shadow-none dark:group-hover:shadow-none dark:group-hover:highlight-white/10',
                'group-hover:shadow-sky-200 dark:group-hover:bg-sky-500',
                'data-selected:dark:bg-sky-500 data-selected:dark:highlight-white/10 dark:bg-slate-800 dark:highlight-white/5'
              ),
              config.theme?.['sidebar.link.icon'] ?? ''
            )}
          >
            <svg
              className="h-6 w-6"
              viewBox="0 0 24 24"
              fill="none"
            >
              {icon}
            </svg>
          </div>
          {children}
        </a>
      </li>
    )
  }
)

function TopLevelLink({
  href,
  as,
  ...props
}: {
  href: string
  as?: string
  children: ReactNode
  className: string
  icon: ReactNode
  isActive: boolean
  onClick?: () => void
  mobile: boolean
}) {
  if (/^https?:\/\//.test(href)) {
    return (
      <TopLevelAnchor
        href={href}
        {...(props as any)}
      />
    )
  }

  return (
    <Link
      href={href}
      as={as}
      passHref
    >
      <TopLevelAnchor {...(props as any)} />
    </Link>
  )
}

function TopLevelNav({ mobile }: { mobile: boolean }) {
  const { pathname } = useRouter()

  return (
    <>
      {config.sidebar?.links!.map((link, idx) => (
        <TopLevelLink
          key={idx}
          mobile={mobile}
          href={link!.url ?? ''}
          isActive={pathname.startsWith(link!.url ?? '')}
          className="mb-4"
          icon={
            <SidebarIcon
              icon={link?.icon ?? 'book'}
              active={pathname.startsWith(link!.url!)}
            />
          }
        >
          {link!.label}
        </TopLevelLink>
      ))}
    </>
  )
}

const SidebarIcon = ({
  icon,
  active
}: {
  icon: 'book' | 'code' | 'chat'
  active: boolean
}) => {
  if (icon === 'book') {
    return (
      <>
        <path
          fillRule="evenodd"
          clipRule="evenodd"
          d="M8.5 7c1.093 0 2.117.27 3 .743V17a6.345 6.345 0 0 0-3-.743c-1.093 0-2.617.27-3.5.743V7.743C5.883 7.27 7.407 7 8.5 7Z"
          className="fill-slate-100 group-hover:fill-slate-50 dark:fill-slate-800 dark:group-hover:fill-slate-900"
        />
        <path
          fillRule="evenodd"
          clipRule="evenodd"
          d="M15.5 7c1.093 0 2.617.27 3.5.743V17c-.883-.473-2.407-.743-3.5-.743s-2.117.27-3 .743V7.743a6.344 6.344 0 0 1 3-.743Z"
          className="fill-slate-200 group-hover:fill-slate-100 dark:fill-slate-700 dark:group-hover:fill-slate-800"
        />
      </>
    )
  }
  if (icon === 'code') {
    return (
      <>
        <path
          d="M4 12a7 7 0 0 1 7-7h2a7 7 0 1 1 0 14h-2a7 7 0 0 1-7-7Z"
          className="fill-white dark:fill-slate-900"
        />
        <path
          d="M10.25 9.75 7.75 12l2.5 2.25"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="fill-slate-50 hover:fill-slate-100 dark:fill-slate-700 dark:hover:fill-slate-800"
        />
        <path
          d="m13.75 9.75 2.5 2.25-2.5 2.25"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="fill-slate-50 hover:fill-slate-100 dark:fill-slate-700 dark:hover:fill-slate-800"
        />
      </>
    )
  }
  if (icon === 'chat') {
    return (
      <>
        <path
          fillRule="evenodd"
          clipRule="evenodd"
          data-is-selected={active ? 'true' : 'false'}
          d="M11 5a6 6 0 0 0-4.687 9.746c.215.27.315.62.231.954l-.514 2.058a1 1 0 0 0 1.485 1.1l2.848-1.71c.174-.104.374-.15.576-.148H13a6 6 0 0 0 0-12h-2Z"
          className="fill-white dark:fill-slate-900"
        />
        <circle
          cx="12"
          cy="11"
          r="1"
          className="fill-slate-50 hover:fill-slate-100 dark:fill-slate-700 dark:hover:fill-slate-800"
        />
        <circle
          cx="9"
          cy="11"
          r="1"
          className="fill-slate-50 hover:fill-slate-100 dark:fill-slate-700 dark:hover:fill-slate-800"
        />
        <circle
          cx="15"
          cy="11"
          r="1"
          className="fill-slate-50 hover:fill-slate-100 dark:fill-slate-700 dark:hover:fill-slate-800"
        />
      </>
    )
  }
  return <></>
}

function Wrapper({
  allowOverflow,
  children
}: {
  allowOverflow: boolean
  children: ReactNode
}) {
  return (
    <div className={allowOverflow ? undefined : 'overflow-hidden'}>
      {children}
    </div>
  )
}

export function SidebarLayout({
  children,
  navIsOpen,
  setNavIsOpen,
  fallbackHref,
  allowOverflow = true
}: {
  children: ReactNode
  navIsOpen: boolean
  setNavIsOpen?: (navIsOpen: boolean) => void
  fallbackHref?: string
  allowOverflow?: boolean
}) {
  return (
    <SidebarContext.Provider value={{ navIsOpen, setNavIsOpen }}>
      <Wrapper allowOverflow={allowOverflow}>
        <div className="max-w-8xl mx-auto px-4 sm:px-6 md:px-8">
          <div className="hidden lg:block fixed z-20 inset-0 top-[3.8125rem] left-[max(0px,calc(50%-45rem))] right-auto w-[19.5rem] pb-10 px-8 overflow-y-auto">
            <Nav fallbackHref={fallbackHref} />
          </div>
          <div className="lg:pl-[19.5rem]">{children}</div>
        </div>
      </Wrapper>
      <Dialog
        as="div"
        open={navIsOpen}
        onClose={() => setNavIsOpen?.(false)}
        className="fixed z-50 inset-0 overflow-y-auto lg:hidden"
      >
        <Dialog.Overlay className="fixed inset-0 bg-black/20 backdrop-blur-sm dark:bg-slate-900/80" />
        <div className="relative bg-white w-80 max-w-[calc(100%-3rem)] p-6 dark:bg-slate-800">
          <button
            type="button"
            onClick={() => setNavIsOpen?.(false)}
            className="absolute z-10 top-5 right-5 w-8 h-8 flex items-center justify-center text-slate-500 hover:text-slate-600 dark:text-slate-400 dark:hover:text-slate-300"
          >
            <span className="sr-only">Close navigation</span>
            <svg
              viewBox="0 0 10 10"
              className="w-2.5 h-2.5 overflow-visible"
            >
              <path
                d="M0 0L10 10M10 0L0 10"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
          </button>
          <Nav
            fallbackHref={fallbackHref}
            mobile={true}
          />
        </div>
      </Dialog>
    </SidebarContext.Provider>
  )
}
