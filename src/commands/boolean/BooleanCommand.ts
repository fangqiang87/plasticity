import * as THREE from "three";
import Command from "../../command/Command";
import { Prompt } from "../../command/CommandPrompt";
import { ObjectPicker } from "../../command/ObjectPicker";
import { SelectionMode } from "../../selection/ChangeSelectionExecutor";
import * as visual from "../../visual_model/VisualModel";
import { MoveGizmo } from '../translate/MoveGizmo';
import { BooleanDialog, CutDialog } from "./BooleanDialog";
import { MovingBooleanFactory, MovingDifferenceFactory, MovingIntersectionFactory, MovingUnionFactory } from './BooleanFactory';
import { MultiCutFactory } from "./CutFactory";
import { CutGizmo } from "./CutGizmo";

abstract class BooleanCommand extends Command {
    protected abstract factory: MovingBooleanFactory;

    async execute(): Promise<void> {
        const { factory, editor } = this;
        factory.resource(this);

        const dialog = new BooleanDialog(factory, editor.signals);
        const gizmo = new MoveGizmo(factory, editor);

        dialog.execute(async (params) => {
            factory.update();
        }).resource(this).then(() => this.finish(), () => this.cancel());

        const objectPicker = new ObjectPicker(this.editor);
        objectPicker.copy(this.editor.selection);
        objectPicker.mode.set(SelectionMode.Solid);

        const solids = await Prompt(
            this.title, "Select target body", editor.signals,
            objectPicker.shift(SelectionMode.Solid, 1)).resource(this);
        factory.target = [...solids][0];

        const tools = await Prompt(
            this.title, "Select tool body", editor.signals,
            objectPicker.slice(SelectionMode.Solid, 1, Number.MAX_SAFE_INTEGER)).resource(this);
        factory.tools = [...tools];

        for (const object of tools) bbox.expandByObject(object);
        bbox.getCenter(centroid);

        await factory.update();

        gizmo.position.copy(centroid);
        gizmo.execute(s => {
            factory.update();
        }).resource(this);

        await Prompt(
            this.title, "Select additional tool bodies", editor.signals,
            objectPicker.execute(async selection => {
                factory.tools = [...selection.solids];
                await factory.update();
            }, 0, Number.MAX_SAFE_INTEGER)
        ).resource(this);

        await this.finished;

        const result = await factory.commit() as visual.Solid;
        editor.selection.selected.addSolid(result);
    }
}

export class UnionCommand extends BooleanCommand {
    protected factory = new MovingUnionFactory(this.editor.db, this.editor.materials, this.editor.signals);
}

export class IntersectionCommand extends BooleanCommand {
    protected factory = new MovingIntersectionFactory(this.editor.db, this.editor.materials, this.editor.signals);
}

export class DifferenceCommand extends BooleanCommand {
    protected factory = new MovingDifferenceFactory(this.editor.db, this.editor.materials, this.editor.signals);
}

export class CutCommand extends Command {
    async execute(): Promise<void> {
        const cut = new MultiCutFactory(this.editor.db, this.editor.materials, this.editor.signals).resource(this);
        cut.constructionPlane = this.editor.activeViewport?.constructionPlane;

        const gizmo = new CutGizmo(cut, this.editor);
        const dialog = new CutDialog(cut, this.editor.signals);

        dialog.execute(async (params) => {
            await cut.update();
        }).resource(this);

        gizmo.execute(async (params) => {
            await cut.update();
        }).resource(this);

        let objectPicker = new ObjectPicker(this.editor);
        objectPicker.copy(this.editor.selection);
        cut.solids = await objectPicker.slice(SelectionMode.Solid, 1, Number.MAX_SAFE_INTEGER).resource(this);
        // cut.faces = [...this.editor.selection.selected.faces];
        cut.curves = [...this.editor.selection.selected.curves];
        await cut.update();

        objectPicker = new ObjectPicker(this.editor);
        objectPicker.mode.set(SelectionMode.Face, SelectionMode.Curve);
        objectPicker.execute(async (selection) => {
            cut.surfaces = [...selection.faces];
            cut.curves = [...selection.curves];
            cut.update();
        }, 1, Number.MAX_SAFE_INTEGER).resource(this);

        await this.finished;

        const results = await cut.commit() as visual.Solid[];
        this.editor.selection.selected.addSolid(results[0]);
    }
}

const bbox = new THREE.Box3();
const centroid = new THREE.Vector3();