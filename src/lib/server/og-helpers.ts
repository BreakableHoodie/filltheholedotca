// Lightweight satori element helper — avoids React dependency.
// props intentionally typed as any: satori's CSS style values are mixed types
// and the return must satisfy satori's internal ReactNode-compatible signature.
//
// Childless elements (shape-only boxes like status dots) MUST yield
// `children: undefined`, not `[]` — satori reads an empty array as a multi-child
// node and throws "Expected <div> to have explicit display: flex ... if it has
// more than one child node", 500-ing the whole OG render.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function el(type: string, props: Record<string, any>, ...children: any[]): any {
	const child =
		children.length === 0 ? undefined : children.length === 1 ? children[0] : children;
	return { type, props: { ...props, children: child } };
}
