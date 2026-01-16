import type { ApiResponse } from "../api.types";
import { api } from "../base";
import type {
  CheckUploadStatusResponse,
  GenerateImgeResponse,
} from "../galgame/EditorData.type";
import type { Scene, SubScene } from "./mapWorldData.type";
import type {
  AddFunctionalNpcResponse,
  CalculatePointsResponse,
  FunctionalNpcPatch,
  GenerateAllFunctionImageResponse,
  GenerateALLSceneImage,
  GenerateFunctionImageResponse,
  GetMusicListResponse,
  NpcSlot,
  UploadMusicResponse,
  UploadNpcImageResponse,
  UploadPlayerImageResponse,
  UploadSceneImageResponse,
  UploadSubSceneImageResponse,
} from "./worldEditor.type";
import type {
  AbilityNode,
  AddAttributesRequest,
  AddAttributesResponse,
  DeleteAttributesRequest,
  GetAttributesResponse,
  NpcAddAttributesRequest,
  NpcDeleteAttributesRequest,
  NpcUpdateAttributesRequest,
  updateAttributesResponse,
  UploadWorldFileResponse,
  WorldSetting as WIWorldSetting,
  NPC as WINPC,
  PlayerCharacter as WIPlayer,
} from "./worldInteractionApi.type";

const worldEditor = {
  uploadWorldFile: (file: File) => {
    const formData = new FormData();
    formData.append("file", file);
    return api.post<UploadWorldFileResponse>(
      `/worldInteraction/document/upload`,
      formData,
      {
        headers: {
          "Content-Type": "multipart/form-data",
        },
        timeout: 1500000,
      }
    );
  },
  createEmptyWorldInteraction: (title: string) => {
    return api.post<UploadWorldFileResponse>(
      `/world-interaction/document/create-empty`,
      { title: title }
    );
  },
  checkUploadStatus: (jobId: string) => {
    return api.get<CheckUploadStatusResponse>(
      `/world-interaction/document/jobs/${jobId}/status`
    );
  },
  updateWorldSetting: (fileId: string, data: Partial<WIWorldSetting>) => {
    return api.put<ApiResponse<WIWorldSetting>>(
      `/world-interaction/edit/${fileId}/world-setting`,
      data
    );
  },
  updatePlayer: (fileId: string, data: Partial<WIPlayer>) => {
    return api.put<ApiResponse<WIPlayer>>(
      `/world-interaction/edit/${fileId}/player`,
      data
    );
  },
  updateNpc: (fileId: string, data: Partial<WINPC>) => {
    return api.put<ApiResponse<WINPC>>(
      `/world-interaction/edit/${fileId}/npcs/${data.id}`,
      data
    );
  },
  updateScene: (fileId: string, data: Scene) => {
    return api.put<ApiResponse<Scene>>(
      `/world-interaction/edit/${fileId}/scenes/${data.id}`,
      data
    );
  },
  updateSubScene: (fileId: string, sceneId: string, data: SubScene) => {
    return api.put<ApiResponse<SubScene>>(
      `/world-interaction/edit/${fileId}/scenes/${sceneId}/subscenes/${data.id}`,
      data
    );
  },
  deleteNpc: (fileId: string, id: string) => {
    return api.delete<ApiResponse<WINPC>>(
      `/world-interaction/edit/${fileId}/npcs/${id}`
    );
  },
  deleteScene: (fileId: string, id: string) => {
    return api.delete<ApiResponse<Scene>>(
      `/world-interaction/edit/${fileId}/scenes/${id}`
    );
  },
  deleteSubScene: (fileId: string, sceneId: string, id: string) => {
    return api.delete<ApiResponse<SubScene>>(
      `/world-interaction/edit/${fileId}/scenes/${sceneId}/subscenes/${id}`
    );
  },
  addNpc: (fileId: string, data: WINPC) => {
    return api.post<ApiResponse<WINPC>>(
      `/world-interaction/edit/${fileId}/npcs`,
      data
    );
  },
  addScene: (fileId: string, data: Scene) => {
    return api.post<ApiResponse<Scene>>(
      `/world-interaction/edit/${fileId}/scenes`,
      data
    );
  },
  addSubScene: (fileId: string, sceneId: string, data: SubScene) => {
    return api.post<ApiResponse<SubScene>>(
      `/world-interaction/edit/${fileId}/scenes/${sceneId}/subscenes`,
      data
    );
  },
  generateAllSceneImages: (fileId: string) => {
    return api.post<ApiResponse<GenerateALLSceneImage>>(
      `/world-interaction/images/generate-scenes-subscenes`,
      {
        fileId: fileId,
      },
      {
        timeout: 1500000,
      }
    );
  },
  uploadSubSceneImage: (
    fileId: string,
    sceneId: string,
    subsceneId: string,
    file: File
  ) => {
    const formData = new FormData();
    formData.append("file", file);
    return api.post<UploadSubSceneImageResponse>(
      `/world-interaction/edit/${fileId}/scenes/${sceneId}/subscenes/${subsceneId}/image`,
      formData,
      {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      }
    );
  },
  uploadSceneImage: (fileId: string, sceneId: string, file: File) => {
    const formData = new FormData();
    formData.append("file", file);
    return api.post<UploadSceneImageResponse>(
      `/world-interaction/edit/${fileId}/scenes/${sceneId}/image`,
      formData,
      {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      }
    );
  },
  uploadNpcImage: (
    fileId: string,
    npcId: string,
    data: { file: File; variat: string }
  ) => {
    const formData = new FormData();
    formData.append("file", data.file);
    formData.append("variant", data.variat);
    return api.post<UploadNpcImageResponse>(
      `/world-interaction/edit/${fileId}/npcs/${npcId}/image`,
      formData,
      {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      }
    );
  },
  uploadPlayerImage: (fileId: string, file: File) => {
    const formData = new FormData();
    formData.append("file", file);
    return api.post<UploadPlayerImageResponse>(
      `/world-interaction/edit/${fileId}/player/image`,
      formData,
      {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      }
    );
  },
  setZoomNpc: (
    fileId: string,
    sceneId: string,
    subsceneId: string,
    npcSlots: NpcSlot[]
  ) => {
    return api.put<ApiResponse<SubScene>>(
      `/world-interaction/edit/${fileId}/scenes/${sceneId}/subscenes/${subsceneId}/npc-slots`,
      {
        npcSlots: npcSlots,
      }
    );
  },
  setSubScenePosition: (
    fileId: string,
    sceneId: string,
    positions: { [key: string]: [number, number] }
  ) => {
    return api.put<ApiResponse<SubScene>>(
      `/world-interaction/edit/${fileId}/scenes/${sceneId}/subscenes/positions`,
      {
        positions: positions,
      }
    );
  },
  setScenePosition: (
    fileId: string,
    positions: { [key: string]: [number, number] }
  ) => {
    return api.put<ApiResponse<Scene>>(
      `/world-interaction/edit/${fileId}/scenes/positions`,
      {
        positions: positions,
      }
    );
  },
  changeSubSceneScene: (
    fileId: string,
    subSceneId: string,
    fromSceneId: string,
    toSceneId: string
  ) => {
    return api.post<ApiResponse<Scene>>(
      `/world-interaction/edit/${fileId}/subscenes/${subSceneId}/move`,
      {
        fromSceneId: fromSceneId,
        toSceneId: toSceneId,
      }
    );
  },
  setWorldMapImage: (fileId: string, file: File) => {
    const formData = new FormData();
    formData.append("file", file);
    return api.post<GenerateImgeResponse>(
      `/world-interaction/edit/${fileId}/world-map/image`,
      formData,
      {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      }
    );
  },
  generateWorldMapImage: (fileId: string) => {
    return api.post<GenerateImgeResponse>(
      `/world-interaction/images/generate-world-map`,
      {
        fileId: fileId,
      },
      {
        timeout: 180000,
      }
    );
  },
  generateSubSceneImage: (
    fileId: string,
    sceneId: string,
    subsceneId: string
  ) => {
    return api.post<{
      success: boolean;
      message: string;
      subsceneId: string;
      imagePath: string;
    }>(
      `/world-interaction/images/generate-subscene`,
      {
        fileId: fileId,
        sceneId: sceneId,
        subsceneId: subsceneId,
      },
      {
        timeout: 180000,
      }
    );
  },
  calculateScenePoints: (fileId: string) => {
    return api.post<CalculatePointsResponse>(
      `/world-interaction/images/generate-scenes/calculate-points`,
      {
        fileId: fileId,
      }
    );
  },
  calculateNpcPoints: (fileId: string) => {
    return api.post<CalculatePointsResponse>(
      `/world-interaction/images/generate-npcs/calculate-points`,
      {
        fileId: fileId,
      }
    );
  },
  calculateAbilityNodePoints: (fileId: string) => {
    return api.post<CalculatePointsResponse>(
      `/world-interaction/images/generate-abilityNodes/calculate-points`,
      {
        fileId: fileId,
      }
    );
  },
  uploadWorldInteractionMusic: (
    fileId: string,
    file: File,
    name: string,
    description: string
  ) => {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("name", name);
    formData.append("description", description);
    return api.post<UploadMusicResponse>(
      `/world-interaction/edit/${fileId}/music`,
      formData,
      {
        headers: {
          "Content-Type": "multipart/form-data",
        },
        timeout: 1500000,
      }
    );
  },
  getWorldInteractionMusicList: (fileId: string) => {
    return api.get<GetMusicListResponse>(
      `/world-interaction/edit/${fileId}/music`
    );
  },
  getWorldInteractionMusic: (fileId: string, musicId: string) => {
    return api.get<Blob>(`/world-interaction/musics/${fileId}/${musicId}`, {
      responseType: "blob",
      headers: {
        "Cache-Control": "no-cache",
      },
    });
  },
  deleteWorldInteractionMusic: (fileId: string, filename: string) => {
    return api.delete<ApiResponse<null>>(
      `/world-interaction/edit/${fileId}/music/${filename}`
    );
  },
  // 功能性NPC相关接口
  getFunctionalNPCs: (fileId: string) => {
    return api.get<ApiResponse<any>>(
      `/world-interaction/edit/${fileId}/functional-npcs`
    );
  },
  createFunctionalNPC: (fileId: string, data: any) => {
    return api.post<ApiResponse<any>>(
      `/world-interaction/edit/${fileId}/functional-npcs`,
      data
    );
  },
  updateFunctionalNPC: (fileId: string, npcId: string, data: any) => {
    return api.put<ApiResponse<any>>(
      `/world-interaction/edit/${fileId}/functional-npcs/${npcId}`,
      data
    );
  },
  deleteFunctionalNPC: (fileId: string, npcId: string) => {
    return api.delete<ApiResponse<null>>(
      `/world-interaction/edit/${fileId}/functional-npcs/${npcId}`
    );
  },
  uploadFunctionalNPCImage: (
    fileId: string,
    npcId: string,
    file: File,
    buttonText?: string
  ) => {
    const formData = new FormData();
    formData.append("file", file);
    if (buttonText) {
      formData.append("buttonText", buttonText);
    }
    return api.post<ApiResponse<any>>(
      `/world-interaction/edit/${fileId}/functional-npcs/${npcId}/image`,
      formData,
      {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      }
    );
  },

  // 功能性NPC相关接口
  generateFunctionalNPCImage: (fileId: string, prompt: string) => {
    return api.post<GenerateFunctionImageResponse>(
      `/world-interaction/images/generate-ability-node`,
      {
        fileId: fileId,
        prompt: prompt,
      },
      {
        timeout: 180000,
      }
    );
  },
  generateAllAbilityNodeImages: (fileId: string) => {
    return api.post<ApiResponse<GenerateAllFunctionImageResponse>>(
      `/world-interaction/images/generate-all-ability-node`,
      {
        fileId: fileId,
      },
      {
        timeout: 1500000,
      }
    );
  },
  addFunctionalNpc: (fileId: string, data: FormData | AbilityNode) => {
    if (data instanceof FormData) {
      // 如果有文件，使用 FormData
      return api.post<AddFunctionalNpcResponse>(
        `/world-interaction/edit/${fileId}/ability-nodes`,
        data,
        {
          headers: {
            "Content-Type": "multipart/form-data",
          },
        }
      );
    } else {
      // 如果没有文件，使用普通 JSON
      return api.post<AddFunctionalNpcResponse>(
        `/world-interaction/edit/${fileId}/ability-nodes`,
        data
      );
    }
  },
  deleteFunctionalNpc: (fileId: string, nodeId: string) => {
    return api.delete<ApiResponse<null>>(
      `/world-interaction/edit/${fileId}/ability-nodes/${nodeId}`
    );
  },
  updateFunctionalNpc: (
    fileId: string,
    nodeId: string,
    data: FormData | Partial<AbilityNode>
  ) => {
    if (data instanceof FormData) {
      // 如果有文件，使用 FormData
      return api.put<AddFunctionalNpcResponse>(
        `/world-interaction/edit/${fileId}/ability-nodes/${nodeId}`,
        data,
        {
          headers: {
            "Content-Type": "multipart/form-data",
          },
        }
      );
    } else {
      // 如果没有文件，使用普通 JSON
      return api.put<AddFunctionalNpcResponse>(
        `/world-interaction/edit/${fileId}/ability-nodes/${nodeId}`,
        data
      );
    }
  },
  deleteFunctionalEvent:(fileId: string, nodeId: string, actionId: string)=>{
    return api.delete<AddFunctionalNpcResponse>(`/world-interaction/edit/${fileId}/ability-nodes/${nodeId}/actions/${actionId}`)
  },
  moveFunctionalNpc:(fileId: string, data: FunctionalNpcPatch)=>{
    return api.post<AddFunctionalNpcResponse>(`/world-interaction/edit/${fileId}/ability-nodes/patch`, data)
  },

  // 属性相关接口
  addAttributeDefinitions: (fileId: string, data: AddAttributesRequest) => {
    return api.post<ApiResponse<AddAttributesResponse>>(`/world-interaction/edit/${fileId}/attributes`, data)
  },
  deleteAttributeDefinitions: (data: DeleteAttributesRequest) => {
    return api.delete<ApiResponse<null>>(`/world-interaction/edit/attributes`, { data })
  },
  updateAttributeDefinitions: (fileId: string, data: AddAttributesRequest) => {
    return api.put<ApiResponse<updateAttributesResponse>>(`/world-interaction/edit/${fileId}/attributes`, data)
  },
  addNpcAttributeDefinitions: (data: NpcAddAttributesRequest) => {
    return api.post<ApiResponse<AddAttributesResponse>>(`/world-interaction/edit/npc/attributes`, data)
  },
  deleteNpcAttributeDefinitions: (data: NpcDeleteAttributesRequest) => {
    return api.delete<ApiResponse<null>>(`/world-interaction/edit/npc/attributes`, { data })
  },
  updateNpcAttributeDefinitions: (fileId: string, data: NpcUpdateAttributesRequest) => {
    return api.put<ApiResponse<AddAttributesResponse>>(`/world-interaction/edit/npc/${fileId}/attributes`, data)
  },
  getAttributes: (sessionId: string) => {
    return api.get<GetAttributesResponse>(`/world-interaction/session/${sessionId}/attributes`)
  },

};

export default worldEditor;
