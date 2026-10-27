import React, { useState } from 'react';
import { VoiceSettings, ChatMessage } from './types';
import { useJarvisVoice } from './hooks/useJarvisVoice';
import { StartupSequence } from './components/StartupSequence';
import { FuturisticHUD } from './components/FuturisticHUD';

export default function App() {
  const [settings, setSettings] = useState<VoiceSettings>({
    voiceName: 'Fenrir',
    continuous: false,
    soundFx: true,
    wakeWordEnabled: true,
    theme: 'stark-cyan',
    speechRate: 1.0,
  });

  const {
    state,
    messages,
    interimTranscript,
    currentResponse,
    isMicActive,
    isMuted,
    telemetry,
    toggleListening,
    sendMessage,
    stopSpeaking,
    toggleMute,
    finishBooting,
    getVisualizerData,
  } = useJarvisVoice(settings);

  const handleReplayAudio = (msg: ChatMessage) => {
    if (msg.text) {
      sendMessage(`Repeat after me: ${msg.text}`);
    }
  };

  const handleClearHistory = () => {
    window.location.reload();
  };

  return (
    <div className="w-full min-h-screen bg-[#040714] text-slate-100">
      {state === 'booting' ? (
        <StartupSequence onComplete={finishBooting} />
      ) : (
        <FuturisticHUD
          state={state}
          settings={settings}
          telemetry={telemetry}
          messages={messages}
          interimTranscript={interimTranscript}
          currentResponse={currentResponse}
          isMicActive={isMicActive}
          isMuted={isMuted}
          onToggleListening={toggleListening}
          onSendMessage={sendMessage}
          onStopSpeaking={stopSpeaking}
          onToggleMute={toggleMute}
          onUpdateSettings={setSettings}
          onReplayAudio={handleReplayAudio}
          onClearHistory={handleClearHistory}
          getVisualizerData={getVisualizerData}
        />
      )}
    </div>
  );
}
