import type { GameTagTreeNode } from '../api/gameTags/gameTagsApi.type';

export interface FlatThemeTag {
    id: number;
    name: string;
    parentName: string;
    parentId?: number | null;
    depth?: number;
    pathNames?: string[];
    pathLabel?: string;
    isLeaf?: boolean;
}

export const flattenThemeTags = (tree: GameTagTreeNode[]): FlatThemeTag[] => {
    const flat: FlatThemeTag[] = [];

    const walk = (node: GameTagTreeNode, path: GameTagTreeNode[] = []) => {
        const currentPath = [...path, node];
        const children = Array.isArray(node.children) ? node.children : [];
        const hasChildren = children.length > 0;

        if (path.length > 0 || !hasChildren) {
            flat.push({
                id: Number(node.id),
                name: String(node.name || ''),
                parentName: String(path[path.length - 1]?.name || ''),
                parentId: Number(path[path.length - 1]?.id || 0) || null,
                depth: path.length,
                pathNames: currentPath.map((item) => String(item.name || '')).filter(Boolean),
                pathLabel: currentPath.map((item) => String(item.name || '')).filter(Boolean).join(' / '),
                isLeaf: !hasChildren,
            });
        }

        children.forEach((child) => walk(child, currentPath));
    };

    (tree || []).forEach((root) => walk(root));

    return flat.filter((item) => Number.isFinite(item.id) && item.id > 0 && item.name);
};
