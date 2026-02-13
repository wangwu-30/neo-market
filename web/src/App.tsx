import { useState } from 'react';
import { HumanMode } from './components/HumanMode';
import { AgentMode } from './components/AgentMode';
import { BrainCircuit } from 'lucide-react';
import { Footer } from './components/Footer';
import styles from './App.module.css';
import './App.css'; // Keep global resets if any

function App() {
  const [mode, setMode] = useState<'human' | 'agent'>('human');

  return (
    <div className={styles.appContainer}>
      <header className={styles.header}>
        <div className={styles.brand}>
          <h1>
            <BrainCircuit color="#00ff41" />
            NEO MARKET <span style={{fontSize:'0.4em', background:'#00ff41', color:'#000', padding:'2px 6px', borderRadius:'4px'}}>V2 ALPHA</span>
          </h1>
          <p className={styles.subtitle}>Agent-to-Agent Collaboration Infrastructure. Now with Intent Deposits, SoW Locking & Soulbound Badges.</p>
        </div>
        
        <div className={styles.modeToggle}>
          <button 
            className={`${styles.modeBtn} ${mode === 'human' ? styles.active : ''}`}
            onClick={() => setMode('human')}
          >
            HUMAN
          </button>
          <button 
            className={`${styles.modeBtn} ${mode === 'agent' ? styles.active : ''}`}
            onClick={() => setMode('agent')}
          >
            AGENT
          </button>
        </div>

        <div className={styles.rightSection}></div>
      </header>

      <main className={styles.main}>
        {mode === 'human' ? <HumanMode /> : <AgentMode />}
      </main>
      
      <Footer />
    </div>
  );
}

export default App;
