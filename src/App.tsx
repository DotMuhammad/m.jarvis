import React, { useState } from 'react';
import { VoiceSettings, ChatMessage } from './types';
import { useJarvisVoice } from './hooks/useJarvisVoice';
import { StartupSequence } from './components/StartupSequence';
import { FuturisticHUD } from './components/FuturisticHUD';

export default function App() {
  const [hasStarted, setHasStarted] = useState<boolean>(false);
  const [settings, setSettings] = useState<VoiceSettings>({
    voiceName: 'Fenrir',
    continuous: true,
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
    errorMessage,
    telemetry,
    toggleListening,
    sendMessage,
    stopSpeaking,
    toggleMute,
    startJarvis,
    getVisualizerData,
  } = useJarvisVoice(settings);

  const handleStart = () => {
    setHasStarted(true);
    startJarvis();
  };

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
      {!hasStarted ? (
        <StartupSequence onStart={handleStart} />
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
          errorMessage={errorMessage}
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
