/**
 * 统一的流式输出UI容器组件
 * 纯UI组件，接收数据并传递给NormalModeDisplay/TextModeDisplay
 * 不包含任何业务逻辑，可被普通NPC和功能性NPC共用
 */
import React from 'react';
import NormalModeDisplay from './Display/NormalModeDisplay';
import TextModeDisplay from './Display/TextModeDisplay';
import { convertStepsToTextModalFormat } from '../../../hooks/mapGalgame/common/interactionUtils';
import type { Message } from '../../../hooks/mapGalgame/common/interactionUtils';

interface StreamOutputContainerProps {
  // 显示模式
  isTextMode: boolean;
  isAutoPlay?: boolean; // 自动播放状态（用于普通模式）
  
  // 普通模式数据
  currentMessage: Message | null;
  finalDisplayText: string;
  finalIsTyping: boolean;
  
  // 文本模式数据
  allSteps: any[];
  currentStepIndex: number;
  textModalDisplayText: string;
  
  // 通用状态
  isWaitingForData: boolean;
  showNextButton: boolean;
  currentStep: any;
  selectedOptionIndex: number | null;
  stepQueue?: any[]; // 步骤队列
  
  // 世界设置（用于转换步骤格式）
  worldSetting: any | null;
  
  // 回调
  onNextMessage: () => void;
  onChoiceClick: (option: { id: number | string; text: string; optionId?: string }) => void;
  onCustomInputSubmit: (value: string) => void;
  isFreeRound?: boolean;
}

const StreamOutputContainer: React.FC<StreamOutputContainerProps> = ({
  isTextMode,
  isAutoPlay = false,
  currentMessage,
  finalDisplayText,
  finalIsTyping,
  allSteps,
  currentStepIndex,
  textModalDisplayText,
  isWaitingForData,
  showNextButton,
  currentStep,
  selectedOptionIndex,
  stepQueue,
  worldSetting,
  onNextMessage,
  onChoiceClick,
  onCustomInputSubmit,
  isFreeRound = false,
}) => {

  // 普通模式  
  if (!isTextMode) {
    return (
      <NormalModeDisplay
        currentMessage={currentMessage}
        finalDisplayText={finalDisplayText}
        finalIsTyping={finalIsTyping}
        stepHandlers={{
          isWaitingForData,
          currentStep,
          showNextButton,
          selectedOptionIndex,
          stepQueue,
        }}
        isAutoPlay={isAutoPlay}
        onNextMessage={onNextMessage}
        onChoiceClick={onChoiceClick}
        onCustomInputSubmit={onCustomInputSubmit}
        isFreeRound={isFreeRound}
      />
    );
  }

  // 文本模式（galgameMap 中父容器已有 padding-bottom，所以不需要 TextModeDisplay 的 padding-bottom）
  return (
    <TextModeDisplay
      steps={convertStepsToTextModalFormat(allSteps, worldSetting)}
      currentStepIndex={currentStepIndex}
      currentDisplayText={textModalDisplayText}
      isTyping={finalIsTyping}
      isWaitingForData={isWaitingForData}
      onChoiceClick={onChoiceClick}
      onCustomInputSubmit={onCustomInputSubmit}
      noPaddingBottom={true}
      isFreeRound={isFreeRound}
    />
  );
};

export default StreamOutputContainer;