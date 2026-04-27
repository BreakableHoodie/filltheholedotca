// Lightweight satori element helper — avoids React dependency.
// props intentionally typed as any: satori's CSS style values are mixed types
// and the return must satisfy satori's internal ReactNode-compatible signature.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function el(type: string, props: Record<string, any>, ...children: any[]): any {
	return { type, props: { ...props, children: children.length === 1 ? children[0] : children } };
}
