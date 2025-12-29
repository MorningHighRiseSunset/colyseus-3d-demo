/** Minimal SkeletonUtils.clone implementation adapted for safe cloning of skinned meshes and skeletons.
 * This is a small helper so we can clone skinned characters with their skeletons intact.
 * Based on THREE.SkeletonUtils from three.js examples.
 */
import * as THREE from './three.module.js';

export const SkeletonUtils = {
    clone: function (source) {
        const sourceLookup = new Map();
        const cloneLookup = new Map();

        const clone = source.clone(true);

        // First pass: map original -> clone
        source.traverse(function (node) {
            sourceLookup.set(node, null);
        });
        clone.traverse(function (node) {
            cloneLookup.set(node.name || node.uuid, node);
        });

        // Second pass: copy skeletons/bones for SkinnedMesh
        const skinnedSourceMeshes = [];
        source.traverse(function (node) {
            if (node.isSkinnedMesh) skinnedSourceMeshes.push(node);
        });

        const skinnedCloneMeshes = [];
        clone.traverse(function (node) {
            if (node.isSkinnedMesh) skinnedCloneMeshes.push(node);
        });

        // If counts align, try to remap skeletons
        for (let i = 0; i < skinnedSourceMeshes.length; i++) {
            const src = skinnedSourceMeshes[i];
            const dst = skinnedCloneMeshes[i];
            if (!src.skeleton || !dst) continue;
            const srcBones = src.skeleton.bones;
            const dstBones = [];
            for (let j = 0; j < srcBones.length; j++) {
                const b = srcBones[j];
                // try to find by name in clone
                const cb = clone.getObjectByName(b.name) || null;
                if (cb) dstBones.push(cb);
            }
            if (dstBones.length === srcBones.length) {
                dst.bind(new THREE.Skeleton(dstBones, src.skeleton.boneInverses.slice()), dst.bindMatrix.clone());
            }
        }

        return clone;
    }
};
