import { serialize, SerializationHelper } from "../Misc/decorators";
import { Tools, IAnimatable } from "../Misc/tools";
import { SmartArray } from "../Misc/smartArray";
import { Observer, Observable } from "../Misc/observable";
import { Nullable } from "../types";
import { Scene } from "../scene";
import { Plane, Matrix } from "../Maths/math";
import { EngineStore } from "../Engines/engineStore";
import { BaseSubMesh, SubMesh } from "../Meshes/subMesh";
import { Geometry } from "../Meshes/geometry";
import { AbstractMesh } from "../Meshes/abstractMesh";
import { Mesh } from "../Meshes/mesh";
import { UniformBuffer } from "./uniformBuffer";
import { Effect } from "./effect";
import { BaseTexture } from "../Materials/Textures/baseTexture";
import { RenderTargetTexture } from "../Materials/Textures/renderTargetTexture";
import { MaterialDefines } from "./materialDefines";
import { Constants } from "../Engines/constants";
import { Logger } from "../Misc/logger";
import { IInspectable } from '../Misc/iInspectable';

declare type Animation = import("../Animations/animation").Animation;

declare var BABYLON: any;

/**
 * Base class for the main features of a material in Babylon.js
 */
export class Material implements IAnimatable {
    /**
     * Returns the triangle fill mode
     */
    public static readonly TriangleFillMode = Constants.MATERIAL_TriangleFillMode;
    /**
     * Returns the wireframe mode
     */
    public static readonly WireFrameFillMode = Constants.MATERIAL_WireFrameFillMode;
    /**
     * Returns the point fill mode
     */
    public static readonly PointFillMode = Constants.MATERIAL_PointFillMode;
    /**
     * Returns the point list draw mode
     */
    public static readonly PointListDrawMode = Constants.MATERIAL_PointListDrawMode;
    /**
     * Returns the line list draw mode
     */
    public static readonly LineListDrawMode = Constants.MATERIAL_LineListDrawMode;
    /**
     * Returns the line loop draw mode
     */
    public static readonly LineLoopDrawMode = Constants.MATERIAL_LineLoopDrawMode;
    /**
     * Returns the line strip draw mode
     */
    public static readonly LineStripDrawMode = Constants.MATERIAL_LineStripDrawMode;
    /**
     * Returns the triangle strip draw mode
     */
    public static readonly TriangleStripDrawMode = Constants.MATERIAL_TriangleStripDrawMode;
    /**
     * Returns the triangle fan draw mode
     */
    public static readonly TriangleFanDrawMode = Constants.MATERIAL_TriangleFanDrawMode;

    /**
     * Stores the clock-wise side orientation
     */
    public static readonly ClockWiseSideOrientation = Constants.MATERIAL_ClockWiseSideOrientation;

    /**
     * Stores the counter clock-wise side orientation
     */
    public static readonly CounterClockWiseSideOrientation = Constants.MATERIAL_CounterClockWiseSideOrientation;

    /**
     * The dirty texture flag value
     */
    public static readonly TextureDirtyFlag = Constants.MATERIAL_TextureDirtyFlag;

    /**
     * The dirty light flag value
     */
    public static readonly LightDirtyFlag = Constants.MATERIAL_LightDirtyFlag;

    /**
     * The dirty fresnel flag value
     */
    public static readonly FresnelDirtyFlag = Constants.MATERIAL_FresnelDirtyFlag;

    /**
     * The dirty attribute flag value
     */
    public static readonly AttributesDirtyFlag = Constants.MATERIAL_AttributesDirtyFlag;

    /**
     * The dirty misc flag value
     */
    public static readonly MiscDirtyFlag = Constants.MATERIAL_MiscDirtyFlag;

    /**
     * The all dirty flag value
     */
    public static readonly AllDirtyFlag = Constants.MATERIAL_AllDirtyFlag;

    /**
     * The ID of the material
     */
    @serialize()
    public id: string;

    /**
     * Gets or sets the unique id of the material
     */
    @serialize()
    public uniqueId: number;

    /**
     * The name of the material
     */
    @serialize()
    public name: string;

    /**
     * Gets or sets user defined metadata
     */
    public metadata: any = null;

    /**
     * For internal use only. Please do not use.
     */
    public reservedDataStore: any = null;

    /**
     * Specifies if the ready state should be checked on each call
     */
    @serialize()
    public checkReadyOnEveryCall = false;

    /**
     * Specifies if the ready state should be checked once
     */
    @serialize()
    public checkReadyOnlyOnce = false;

    /**
     * The state of the material
     */
    @serialize()
    public state = "";

    /**
     * The alpha value of the material
     */
    @serialize("alpha")
    protected _alpha = 1.0;

    /**
     * List of inspectable custom properties (used by the Inspector)
     * @see https://doc.babylonjs.com/how_to/debug_layer#extensibility
     */
    public inspectableCustomProperties: IInspectable[];

    /**
     * Sets the alpha value of the material
     */
    public set alpha(value: number) {
        if (this._alpha === value) {
            return;
        }
        this._alpha = value;
        this.markAsDirty(Material.MiscDirtyFlag);
    }

    /**
     * Gets the alpha value of the material
     */
    public get alpha(): number {
        return this._alpha;
    }

    /**
     * Specifies if back face culling is enabled
     */
    @serialize("backFaceCulling")
    protected _backFaceCulling = true;

    /**
     * Sets the back-face culling state
     */
    public set backFaceCulling(value: boolean) {
        if (this._backFaceCulling === value) {
            return;
        }
        this._backFaceCulling = value;
        this.markAsDirty(Material.TextureDirtyFlag);
    }

    /**
     * Gets the back-face culling state
     */
    public get backFaceCulling(): boolean {
        return this._backFaceCulling;
    }

    /**
     * Stores the value for side orientation
     */
    @serialize()
    public sideOrientation: number;

    /**
     * Callback triggered when the material is compiled
     */
    public onCompiled: (effect: Effect) => void;

    /**
     * Callback triggered when an error occurs
     */
    public onError: (effect: Effect, errors: string) => void;

    /**
     * Callback triggered to get the render target textures
     */
    public getRenderTargetTextures: () => SmartArray<RenderTargetTexture>;

    /**
     * Gets a boolean indicating that current material needs to register RTT
     */
    public get hasRenderTargetTextures(): boolean {
        return false;
    }

    /**
     * Specifies if the material should be serialized
     */
    public doNotSerialize = false;

    /**
     * @hidden
     */
    public _storeEffectOnSubMeshes = false;

    /**
     * Stores the animations for the material
     */
    public animations: Array<Animation>;

    /**
    * An event triggered when the material is disposed
    */
    public onDisposeObservable = new Observable<Material>();

    /**
     * An observer which watches for dispose events
     */
    private _onDisposeObserver: Nullable<Observer<Material>>;
    private _onUnBindObservable: Nullable<Observable<Material>>;

    /**
     * Called during a dispose event
     */
    public set onDispose(callback: () => void) {
        if (this._onDisposeObserver) {
            this.onDisposeObservable.remove(this._onDisposeObserver);
        }
        this._onDisposeObserver = this.onDisposeObservable.add(callback);
    }

    private _onBindObservable: Nullable<Observable<AbstractMesh>>;

    /**
    * An event triggered when the material is bound
    */
    public get onBindObservable(): Observable<AbstractMesh> {
        if (!this._onBindObservable) {
            this._onBindObservable = new Observable<AbstractMesh>();
        }

        return this._onBindObservable;
    }

    /**
     * An observer which watches for bind events
     */
    private _onBindObserver: Nullable<Observer<AbstractMesh>>;

    /**
     * Called during a bind event
     */
    public set onBind(callback: (Mesh: AbstractMesh) => void) {
        if (this._onBindObserver) {
            this.onBindObservable.remove(this._onBindObserver);
        }
        this._onBindObserver = this.onBindObservable.add(callback);
    }

    /**
    * An event triggered when the material is unbound
    */
    public get onUnBindObservable(): Observable<Material> {
        if (!this._onUnBindObservable) {
            this._onUnBindObservable = new Observable<Material>();
        }

        return this._onUnBindObservable;
    }

    /**
     * Stores the value of the alpha mode
     */
    @serialize("alphaMode")
    private _alphaMode: number = Constants.ALPHA_COMBINE;

    /**
     * Sets the value of the alpha mode.
     *
     * | Value | Type | Description |
     * | --- | --- | --- |
     * | 0 | ALPHA_DISABLE |   |
     * | 1 | ALPHA_ADD |   |
     * | 2 | ALPHA_COMBINE |   |
     * | 3 | ALPHA_SUBTRACT |   |
     * | 4 | ALPHA_MULTIPLY |   |
     * | 5 | ALPHA_MAXIMIZED |   |
     * | 6 | ALPHA_ONEONE |   |
     * | 7 | ALPHA_PREMULTIPLIED |   |
     * | 8 | ALPHA_PREMULTIPLIED_PORTERDUFF |   |
     * | 9 | ALPHA_INTERPOLATE |   |
     * | 10 | ALPHA_SCREENMODE |   |
     *
     */
    public set alphaMode(value: number) {
        if (this._alphaMode === value) {
            return;
        }
        this._alphaMode = value;
        this.markAsDirty(Material.TextureDirtyFlag);
    }

    /**
     * Gets the value of the alpha mode
     */
    public get alphaMode(): number {
        return this._alphaMode;
    }

    /**
     * Stores the state of the need depth pre-pass value
     */
    @serialize()
    private _needDepthPrePass = false;

    /**
     * Sets the need depth pre-pass value
     */
    public set needDepthPrePass(value: boolean) {
        if (this._needDepthPrePass === value) {
            return;
        }
        this._needDepthPrePass = value;
        if (this._needDepthPrePass) {
            this.checkReadyOnEveryCall = true;
        }
    }

    /**
     * Gets the depth pre-pass value
     */
    public get needDepthPrePass(): boolean {
        return this._needDepthPrePass;
    }

    /**
     * Specifies if depth writing should be disabled
     */
    @serialize()
    public disableDepthWrite = false;

    /**
     * Specifies if depth writing should be forced
     */
    @serialize()
    public forceDepthWrite = false;

    /**
     * Specifies if there should be a separate pass for culling
     */
    @serialize()
    public separateCullingPass = false;

    /**
     * Stores the state specifing if fog should be enabled
     */
    @serialize("fogEnabled")
    private _fogEnabled = true;

    /**
     * Sets the state for enabling fog
     */
    public set fogEnabled(value: boolean) {
        if (this._fogEnabled === value) {
            return;
        }
        this._fogEnabled = value;
        this.markAsDirty(Material.MiscDirtyFlag);
    }

    /**
     * Gets the value of the fog enabled state
     */
    public get fogEnabled(): boolean {
        return this._fogEnabled;
    }

    /**
     * Stores the size of points
     */
    @serialize()
    public pointSize = 1.0;

    /**
     * Stores the z offset value
     */
    @serialize()
    public zOffset = 0;

    /**
     * Gets a value specifying if wireframe mode is enabled
     */
    @serialize()
    public get wireframe(): boolean {
        switch (this._fillMode) {
            case Material.WireFrameFillMode:
            case Material.LineListDrawMode:
            case Material.LineLoopDrawMode:
            case Material.LineStripDrawMode:
                return true;
        }

        return this._scene.forceWireframe;
    }

    /**
     * Sets the state of wireframe mode
     */
    public set wireframe(value: boolean) {
        this.fillMode = (value ? Material.WireFrameFillMode : Material.TriangleFillMode);
    }

    /**
     * Gets the value specifying if point clouds are enabled
     */
    @serialize()
    public get pointsCloud(): boolean {
        switch (this._fillMode) {
            case Material.PointFillMode:
            case Material.PointListDrawMode:
                return true;
        }

        return this._scene.forcePointsCloud;
    }

    /**
     * Sets the state of point cloud mode
     */
    public set pointsCloud(value: boolean) {
        this.fillMode = (value ? Material.PointFillMode : Material.TriangleFillMode);
    }

    /**
     * Gets the material fill mode
     */
    @serialize()
    public get fillMode(): number {
        return this._fillMode;
    }

    /**
     * Sets the material fill mode
     */
    public set fillMode(value: number) {
        if (this._fillMode === value) {
            return;
        }

        this._fillMode = value;
        this.markAsDirty(Material.MiscDirtyFlag);
    }

    /**
     * @hidden
     * Stores the effects for the material
     */
    public _effect: Nullable<Effect>;

    /**
     * @hidden
     * Specifies if the material was previously ready
     */
    public _wasPreviouslyReady = false;

    /**
     * Specifies if uniform buffers should be used
     */
    private _useUBO: boolean;

    /**
     * Stores a reference to the scene
     */
    private _scene: Scene;

    /**
     * Stores the fill mode state
     */
    private _fillMode = Material.TriangleFillMode;

    /**
     * Specifies if the depth write state should be cached
     */
    private _cachedDepthWriteState: boolean;

    /**
     * Stores the uniform buffer
     */
    protected _uniformBuffer: UniformBuffer;

    /** @hidden */
    public _indexInSceneMaterialArray = -1;

    /** @hidden */
    public meshMap: Nullable<{ [id: string]: AbstractMesh | undefined }>;

    /**
     * Creates a material instance
     * @param name defines the name of the material
     * @param scene defines the scene to reference
     * @param doNotAdd specifies if the material should be added to the scene
     */
    constructor(name: string, scene: Scene, doNotAdd?: boolean) {
        this.name = name;
        this.id = name || Tools.RandomId();

        this._scene = scene || EngineStore.LastCreatedScene;
        this.uniqueId = this._scene.getUniqueId();

        if (this._scene.useRightHandedSystem) {
            this.sideOrientation = Material.ClockWiseSideOrientation;
        } else {
            this.sideOrientation = Material.CounterClockWiseSideOrientation;
        }

        this._uniformBuffer = new UniformBuffer(this._scene.getEngine());
        this._useUBO = this.getScene().getEngine().supportsUniformBuffers;

        if (!doNotAdd) {
            this._scene.addMaterial(this);
        }

        if (this._scene.useMaterialMeshMap) {
            this.meshMap = {};
        }
    }

    /**
     * Returns a string representation of the current material
     * @param fullDetails defines a boolean indicating which levels of logging is desired
     * @returns a string with material information
     */
    public toString(fullDetails?: boolean): string {
        var ret = "Name: " + this.name;
        if (fullDetails) {
        }
        return ret;
    }

    /**
     * Gets the class name of the material
     * @returns a string with the class name of the material
     */
    public getClassName(): string {
        return "Material";
    }

    /**
     * Specifies if updates for the material been locked
     */
    public get isFrozen(): boolean {
        return this.checkReadyOnlyOnce;
    }

    /**
     * Locks updates for the material
     */
    public freeze(): void {
        this.checkReadyOnlyOnce = true;
    }

    /**
     * Unlocks updates for the material
     */
    public unfreeze(): void {
        this.checkReadyOnlyOnce = false;
    }

    /**
     * Specifies if the material is ready to be used
     * @param mesh defines the mesh to check
     * @param useInstances specifies if instances should be used
     * @returns a boolean indicating if the material is ready to be used
     */
    public isReady(mesh?: AbstractMesh, useInstances?: boolean): boolean {
        return true;
    }

    /**
     * Specifies that the submesh is ready to be used
     * @param mesh defines the mesh to check
     * @param subMesh defines which submesh to check
     * @param useInstances specifies that instances should be used
     * @returns a boolean indicating that the submesh is ready or not
     */
    public isReadyForSubMesh(mesh: AbstractMesh, subMesh: BaseSubMesh, useInstances?: boolean): boolean {
        return false;
    }

    /**
     * Returns the material effect
     * @returns the effect associated with the material
     */
    public getEffect(): Nullable<Effect> {
        return this._effect;
    }

    /**
     * Returns the current scene
     * @returns a Scene
     */
    public getScene(): Scene {
        return this._scene;
    }

    /**
     * Specifies if the material will require alpha blending
     * @returns a boolean specifying if alpha blending is needed
     */
    public needAlphaBlending(): boolean {
        return (this.alpha < 1.0);
    }

    /**
     * Specifies if the mesh will require alpha blending
     * @param mesh defines the mesh to check
     * @returns a boolean specifying if alpha blending is needed for the mesh
     */
    public needAlphaBlendingForMesh(mesh: AbstractMesh): boolean {
        return this.needAlphaBlending() || (mesh.visibility < 1.0) || mesh.hasVertexAlpha;
    }

    /**
     * Specifies if this material should be rendered in alpha test mode
     * @returns a boolean specifying if an alpha test is needed.
     */
    public needAlphaTesting(): boolean {
        return false;
    }

    /**
     * Gets the texture used for the alpha test
     * @returns the texture to use for alpha testing
     */
    public getAlphaTestTexture(): Nullable<BaseTexture> {
        return null;
    }

    /**
     * Marks the material to indicate that it needs to be re-calculated
     */
    public markDirty(): void {
        this._wasPreviouslyReady = false;
    }

    /** @hidden */
    public _preBind(effect?: Effect, overrideOrientation: Nullable<number> = null): boolean {
        var engine = this._scene.getEngine();

        var orientation = (overrideOrientation == null) ? this.sideOrientation : overrideOrientation;
        var reverse = orientation === Material.ClockWiseSideOrientation;

        engine.enableEffect(effect ? effect : this._effect);
        engine.setState(this.backFaceCulling, this.zOffset, false, reverse);

        return reverse;
    }

    /**
     * Binds the material to the mesh
     * @param world defines the world transformation matrix
     * @param mesh defines the mesh to bind the material to
     */
    public bind(world: Matrix, mesh?: Mesh): void {
    }

    /**
     * Binds the submesh to the material
     * @param world defines the world transformation matrix
     * @param mesh defines the mesh containing the submesh
     * @param subMesh defines the submesh to bind the material to
     */
    public bindForSubMesh(world: Matrix, mesh: Mesh, subMesh: SubMesh): void {
    }

    /**
     * Binds the world matrix to the material
     * @param world defines the world transformation matrix
     */
    public bindOnlyWorldMatrix(world: Matrix): void {
    }

    /**
     * Binds the scene's uniform buffer to the effect.
     * @param effect defines the effect to bind to the scene uniform buffer
     * @param sceneUbo defines the uniform buffer storing scene data
     */
    public bindSceneUniformBuffer(effect: Effect, sceneUbo: UniformBuffer): void {
        sceneUbo.bindToEffect(effect, "Scene");
    }

    /**
     * Binds the view matrix to the effect
     * @param effect defines the effect to bind the view matrix to
     */
    public bindView(effect: Effect): void {
        if (!this._useUBO) {
            effect.setMatrix("view", this.getScene().getViewMatrix());
        } else {
            this.bindSceneUniformBuffer(effect, this.getScene().getSceneUniformBuffer());
        }
    }

    /**
     * Binds the view projection matrix to the effect
     * @param effect defines the effect to bind the view projection matrix to
     */
    public bindViewProjection(effect: Effect): void {
        if (!this._useUBO) {
            effect.setMatrix("viewProjection", this.getScene().getTransformMatrix());
        } else {
            this.bindSceneUniformBuffer(effect, this.getScene().getSceneUniformBuffer());
        }
    }

    /**
     * Specifies if material alpha testing should be turned on for the mesh
     * @param mesh defines the mesh to check
     */
    protected _shouldTurnAlphaTestOn(mesh: AbstractMesh): boolean {
        return (!this.needAlphaBlendingForMesh(mesh) && this.needAlphaTesting());
    }

    /**
     * Processes to execute after binding the material to a mesh
     * @param mesh defines the rendered mesh
     */
    protected _afterBind(mesh?: Mesh): void {
        this._scene._cachedMaterial = this;
        if (mesh) {
            this._scene._cachedVisibility = mesh.visibility;
        } else {
            this._scene._cachedVisibility = 1;
        }

        if (this._onBindObservable && mesh) {
            this._onBindObservable.notifyObservers(mesh);
        }

        if (this.disableDepthWrite) {
            var engine = this._scene.getEngine();
            this._cachedDepthWriteState = engine.getDepthWrite();
            engine.setDepthWrite(false);
        }
    }

    /**
     * Unbinds the material from the mesh
     */
    public unbind(): void {
        if (this._onUnBindObservable) {
            this._onUnBindObservable.notifyObservers(this);
        }

        if (this.disableDepthWrite) {
            var engine = this._scene.getEngine();
            engine.setDepthWrite(this._cachedDepthWriteState);
        }
    }

    /**
     * Gets the active textures from the material
     * @returns an array of textures
     */
    public getActiveTextures(): BaseTexture[] {
        return [];
    }

    /**
     * Specifies if the material uses a texture
     * @param texture defines the texture to check against the material
     * @returns a boolean specifying if the material uses the texture
     */
    public hasTexture(texture: BaseTexture): boolean {
        return false;
    }

    /**
     * Makes a duplicate of the material, and gives it a new name
     * @param name defines the new name for the duplicated material
     * @returns the cloned material
     */
    public clone(name: string): Nullable<Material> {
        return null;
    }

    /**
     * Gets the meshes bound to the material
     * @returns an array of meshes bound to the material
     */
    public getBindedMeshes(): AbstractMesh[] {
        if (this.meshMap) {
            var result = new Array<AbstractMesh>();
            for (let meshId in this.meshMap) {
                const mesh = this.meshMap[meshId];
                if (mesh) {
                    result.push(mesh);
                }
            }
            return result;
        }
        else {
            const meshes = this._scene.meshes;
            return meshes.filter((mesh) => mesh.material === this);
        }
    }

    /**
     * Force shader compilation
     * @param mesh defines the mesh associated with this material
     * @param onCompiled defines a function to execute once the material is compiled
     * @param options defines the options to configure the compilation
     */
    public forceCompilation(mesh: AbstractMesh, onCompiled?: (material: Material) => void, options?: Partial<{ clipPlane: boolean }>): void {
        let localOptions = {
            clipPlane: false,
            ...options
        };

        var subMesh = new BaseSubMesh();
        var scene = this.getScene();

        var checkReady = () => {
            if (!this._scene || !this._scene.getEngine()) {
                return;
            }

            if (subMesh._materialDefines) {
                subMesh._materialDefines._renderId = -1;
            }

            var clipPlaneState = scene.clipPlane;

            if (localOptions.clipPlane) {
                scene.clipPlane = new Plane(0, 0, 0, 1);
            }

            if (this._storeEffectOnSubMeshes) {
                if (this.isReadyForSubMesh(mesh, subMesh)) {
                    if (onCompiled) {
                        onCompiled(this);
                    }
                }
                else {
                    setTimeout(checkReady, 16);
                }
            } else {
                if (this.isReady()) {
                    if (onCompiled) {
                        onCompiled(this);
                    }
                }
                else {
                    setTimeout(checkReady, 16);
                }
            }

            if (localOptions.clipPlane) {
                scene.clipPlane = clipPlaneState;
            }
        };

        checkReady();
    }

    /**
     * Force shader compilation
     * @param mesh defines the mesh that will use this material
     * @param options defines additional options for compiling the shaders
     * @returns a promise that resolves when the compilation completes
     */
    public forceCompilationAsync(mesh: AbstractMesh, options?: Partial<{ clipPlane: boolean }>): Promise<void> {
        return new Promise((resolve) => {
            this.forceCompilation(mesh, () => {
                resolve();
            }, options);
        });
    }

    private static readonly _ImageProcessingDirtyCallBack = (defines: MaterialDefines) => defines.markAsImageProcessingDirty();
    private static readonly _TextureDirtyCallBack = (defines: MaterialDefines) => defines.markAsTexturesDirty();
    private static readonly _FresnelDirtyCallBack = (defines: MaterialDefines) => defines.markAsFresnelDirty();
    private static readonly _MiscDirtyCallBack = (defines: MaterialDefines) => defines.markAsMiscDirty();
    private static readonly _LightsDirtyCallBack = (defines: MaterialDefines) => defines.markAsLightDirty();
    private static readonly _AttributeDirtyCallBack = (defines: MaterialDefines) => defines.markAsAttributesDirty();

    private static _FresnelAndMiscDirtyCallBack = (defines: MaterialDefines) => {
        Material._FresnelDirtyCallBack(defines);
        Material._MiscDirtyCallBack(defines);
    }

    private static _TextureAndMiscDirtyCallBack = (defines: MaterialDefines) => {
        Material._TextureDirtyCallBack(defines);
        Material._MiscDirtyCallBack(defines);
    }

    private static readonly _DirtyCallbackArray: Array<(defines: MaterialDefines) => void> = [];
    private static readonly _RunDirtyCallBacks = (defines: MaterialDefines) => {
        for (const cb of Material._DirtyCallbackArray) {
            cb(defines);
        }
    }

    /**
     * Marks a define in the material to indicate that it needs to be re-computed
     * @param flag defines a flag used to determine which parts of the material have to be marked as dirty
     */
    public markAsDirty(flag: number): void {
        if (this.getScene().blockMaterialDirtyMechanism) {
            return;
        }

        Material._DirtyCallbackArray.length = 0;

        if (flag & Material.TextureDirtyFlag) {
            Material._DirtyCallbackArray.push(Material._TextureDirtyCallBack);
        }

        if (flag & Material.LightDirtyFlag) {
            Material._DirtyCallbackArray.push(Material._LightsDirtyCallBack);
        }

        if (flag & Material.FresnelDirtyFlag) {
            Material._DirtyCallbackArray.push(Material._FresnelDirtyCallBack);
        }

        if (flag & Material.AttributesDirtyFlag) {
            Material._DirtyCallbackArray.push(Material._AttributeDirtyCallBack);
        }

        if (flag & Material.MiscDirtyFlag) {
            Material._DirtyCallbackArray.push(Material._MiscDirtyCallBack);
        }

        if (Material._DirtyCallbackArray.length) {
            this._markAllSubMeshesAsDirty(Material._RunDirtyCallBacks);
        }

        this.getScene().resetCachedMaterial();
    }

    /**
     * Marks all submeshes of a material to indicate that their material defines need to be re-calculated
     * @param func defines a function which checks material defines against the submeshes
     */
    protected _markAllSubMeshesAsDirty(func: (defines: MaterialDefines) => void) {
        if (this.getScene().blockMaterialDirtyMechanism) {
            return;
        }

        const meshes = this.getScene().meshes;
        for (var mesh of meshes) {
            if (!mesh.subMeshes) {
                continue;
            }
            for (var subMesh of mesh.subMeshes) {
                if (subMesh.getMaterial() !== this) {
                    continue;
                }

                if (!subMesh._materialDefines) {
                    continue;
                }

                func(subMesh._materialDefines);
            }
        }
    }

    /**
     * Indicates that image processing needs to be re-calculated for all submeshes
     */
    protected _markAllSubMeshesAsImageProcessingDirty() {
        this._markAllSubMeshesAsDirty(Material._ImageProcessingDirtyCallBack);
    }

    /**
     * Indicates that textures need to be re-calculated for all submeshes
     */
    protected _markAllSubMeshesAsTexturesDirty() {
        this._markAllSubMeshesAsDirty(Material._TextureDirtyCallBack);
    }

    /**
     * Indicates that fresnel needs to be re-calculated for all submeshes
     */
    protected _markAllSubMeshesAsFresnelDirty() {
        this._markAllSubMeshesAsDirty(Material._FresnelDirtyCallBack);
    }

    /**
     * Indicates that fresnel and misc need to be re-calculated for all submeshes
     */
    protected _markAllSubMeshesAsFresnelAndMiscDirty() {
        this._markAllSubMeshesAsDirty(Material._FresnelAndMiscDirtyCallBack);
    }

    /**
     * Indicates that lights need to be re-calculated for all submeshes
     */
    protected _markAllSubMeshesAsLightsDirty() {
        this._markAllSubMeshesAsDirty(Material._LightsDirtyCallBack);
    }

    /**
     * Indicates that attributes need to be re-calculated for all submeshes
     */
    protected _markAllSubMeshesAsAttributesDirty() {
        this._markAllSubMeshesAsDirty(Material._AttributeDirtyCallBack);
    }

    /**
     * Indicates that misc needs to be re-calculated for all submeshes
     */
    protected _markAllSubMeshesAsMiscDirty() {
        this._markAllSubMeshesAsDirty(Material._MiscDirtyCallBack);
    }

    /**
     * Indicates that textures and misc need to be re-calculated for all submeshes
     */
    protected _markAllSubMeshesAsTexturesAndMiscDirty() {
        this._markAllSubMeshesAsDirty(Material._TextureAndMiscDirtyCallBack);
    }

    /**
     * Disposes the material
     * @param forceDisposeEffect specifies if effects should be forcefully disposed
     * @param forceDisposeTextures specifies if textures should be forcefully disposed
     * @param notBoundToMesh specifies if the material that is being disposed is known to be not bound to any mesh
     */
    public dispose(forceDisposeEffect?: boolean, forceDisposeTextures?: boolean, notBoundToMesh?: boolean): void {
        const scene = this.getScene();
        // Animations
        scene.stopAnimation(this);
        scene.freeProcessedMaterials();

        // Remove from scene
        scene.removeMaterial(this);

        if (notBoundToMesh !== true) {
            // Remove from meshes
            if (this.meshMap) {
                for (let meshId in this.meshMap) {
                    const mesh = this.meshMap[meshId];
                    if (mesh) {
                        mesh.material = null; // will set the entry in the map to undefined
                        this.releaseVertexArrayObject(mesh, forceDisposeEffect);
                    }
                }
            }
            else {
                const meshes = scene.meshes;
                for (let mesh of meshes) {
                    if (mesh.material === this) {
                        mesh.material = null;
                        this.releaseVertexArrayObject(mesh, forceDisposeEffect);
                    }
                }
            }
        }

        this._uniformBuffer.dispose();

        // Shader are kept in cache for further use but we can get rid of this by using forceDisposeEffect
        if (forceDisposeEffect && this._effect) {
            if (!this._storeEffectOnSubMeshes) {
                this._effect.dispose();
            }

            this._effect = null;
        }

        // Callback
        this.onDisposeObservable.notifyObservers(this);

        this.onDisposeObservable.clear();
        if (this._onBindObservable) {
            this._onBindObservable.clear();
        }

        if (this._onUnBindObservable) {
            this._onUnBindObservable.clear();
        }
    }

    /** @hidden */
    private releaseVertexArrayObject(mesh: AbstractMesh, forceDisposeEffect?: boolean) {
        if ((<Mesh>mesh).geometry) {
            var geometry = <Geometry>((<Mesh>mesh).geometry);
            if (this._storeEffectOnSubMeshes) {
                for (var subMesh of mesh.subMeshes) {
                    geometry._releaseVertexArrayObject(subMesh._materialEffect);
                    if (forceDisposeEffect && subMesh._materialEffect) {
                        subMesh._materialEffect.dispose();
                    }
                }
            } else {
                geometry._releaseVertexArrayObject(this._effect);
            }
        }
    }

    /**
     * Serializes this material
     * @returns the serialized material object
     */
    public serialize(): any {
        return SerializationHelper.Serialize(this);
    }

    /**
     * Creates a material from parsed material data
     * @param parsedMaterial defines parsed material data
     * @param scene defines the hosting scene
     * @param rootUrl defines the root URL to use to load textures
     * @returns a new material
     */
    public static Parse(parsedMaterial: any, scene: Scene, rootUrl: string): Nullable<Material> {
        if (!parsedMaterial.customType) {
            parsedMaterial.customType = "BABYLON.StandardMaterial";
        }
        else if (parsedMaterial.customType === "BABYLON.PBRMaterial" && parsedMaterial.overloadedAlbedo) {
            parsedMaterial.customType = "BABYLON.LegacyPBRMaterial";
            if (!BABYLON.LegacyPBRMaterial) {
                Logger.Error("Your scene is trying to load a legacy version of the PBRMaterial, please, include it from the materials library.");
                return null;
            }
        }

        var materialType = Tools.Instantiate(parsedMaterial.customType);
        return materialType.Parse(parsedMaterial, scene, rootUrl);
    }
}