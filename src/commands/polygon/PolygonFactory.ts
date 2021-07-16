import { PlaneSnap } from "../../SnapManager";
import * as THREE from "three";
import c3d from '../../../build/Release/c3d.node';
import { vec2cart } from "../../util/Conversion";
import { GeometryFactory } from '../Factory';

export class PolygonFactory extends GeometryFactory {
    center!: THREE.Vector3;
    p2!: THREE.Vector3;
    vertexCount = 5;
    constructionPlane = new PlaneSnap();

    protected async computeGeometry() {
        const { center, p2, vertexCount, constructionPlane: { n } } = this;
        const polygon = c3d.ActionCurve3D.RegularPolygon(vec2cart(center), vec2cart(p2), new c3d.Vector3D(n.x, n.y, n.z), vertexCount, false);

        return new c3d.SpaceInstance(polygon);
    }
}