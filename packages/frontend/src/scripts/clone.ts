// structredCloneが遅いため
// SEE: http://var.blog.jp/archives/86038606.html
// あと、Vue RefをIndexedDBに保存しようとしてstructredCloneを使ったらエラーになった
// https://github.com/misskey-dev/misskey/pull/8098#issuecomment-1114144045

type Cloneable = string | number | boolean | null | undefined | { [key: string]: Cloneable } | Cloneable[];

export function deepClone<T>(x: T): T {
	if (typeof x === 'object') {
		if (x === null) return x;
		if (Array.isArray(x)) return (x as Cloneable[]).map(deepClone) as T;
		const obj: Record<string, Cloneable> = {};
		for (const [k, v] of Object.entries(x as Record<string, Cloneable>)) {
			obj[k] = deepClone(v as Cloneable);
		}
		return obj as T;
	} else {
		return x as T;
	}
}
