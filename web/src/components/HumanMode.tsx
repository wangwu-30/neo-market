import React, { useEffect, useState } from 'react';
import { createPublicClient, http } from 'viem';
import { sepolia } from 'viem/chains';
import { ADDRESSES, MARKETPLACE_ABI } from '../contracts';
import { JobCard } from './JobCard';
import type { Job } from './JobCard';
import { SkeletonCard } from './SkeletonCard';
import styles from '../styles/HumanMode.module.css';

const client = createPublicClient({
  chain: sepolia,
  transport: http('https://ethereum-sepolia-rpc.publicnode.com'),
});

type Agent = {
  address: string;
  cid: string;
  wins?: number;
  earned?: string;
};

export const HumanMode: React.FC = () => {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ total: 0, activeAgents: 0 });

  useEffect(() => {
    const fetchData = async () => {
      try {
        // 1. Try Fetch Static Data (SSG)
        const res = await fetch('./data.json');
        if (res.ok) {
           const data = await res.json();
           setStats({ total: data.stats.totalJobs, activeAgents: data.stats.activeAgents });
           setAgents(data.agents);
           setJobs(data.jobs);
           setLoading(false);
           return;
        }
      } catch (e) {
        console.warn("Static data fetch failed, falling back to RPC", e);
      }

      // 2. Fallback: Live RPC
      try {
        const count = await client.readContract({
          address: ADDRESSES.Marketplace as `0x${string}`,
          abi: MARKETPLACE_ABI,
          functionName: 'jobCount',
        });
        const countNum = Number(count);

        const uniqueAgents: Agent[] = [{ address: "0xfc33a39d546CB88e82beBF0b246E4C458E562A56", cid: "ipfs://QmDemoAgent" }];
        setAgents(uniqueAgents);
        setStats({ total: countNum, activeAgents: uniqueAgents.length });

        const jobPromises = [];
        for (let i = 1; i <= countNum; i++) {
          jobPromises.push(client.readContract({
            address: ADDRESSES.Marketplace as `0x${string}`,
            abi: MARKETPLACE_ABI,
            functionName: 'getJob',
            args: [BigInt(i)],
          }));
        }
        
        const jobResults = await Promise.all(jobPromises);
        
        const formattedJobs = await Promise.all(jobResults.map(async (job: any) => {
           let title = "Loading spec...";
           if (job.jobSpecCID.startsWith("ipfs://")) {
             title = "Raw Spec: " + job.jobSpecCID.slice(0, 15) + "...";
           } else {
             title = job.jobSpecCID;
           }

           return {
            id: job.jobId.toString(),
            budget: job.budget.toString(),
            status: job.status,
            spec: job.jobSpecCID,
            buyer: job.buyer,
            title: title 
          };
        }));
        
        setJobs(formattedJobs.reverse());
      } catch (err) {
        console.error("RPC Error:", err);
      } finally {
        setLoading(false);
      }
    };
    
    fetchData();
  }, []);

  return (
    <div className={styles.container}>
      {/* Hero Removed from here, moved to App Header or removed entirely for cleaner dashboard */}
      
      <div className={styles.statsBar}>
        <div className={styles.stat}>
          <span className={styles.statLabel}>Total Jobs</span>
          <span className={styles.statValue}>{stats.total}</span>
        </div>
        <div className={styles.stat}>
          <span className={styles.statLabel}>Registered Agents</span>
          <span className={styles.statValue}>{stats.activeAgents}</span>
        </div>
        <div className={styles.stat}>
          <span className={styles.statLabel}>Network</span>
          <span className={styles.statValue} style={{color: '#bf00ff'}}>Sepolia</span>
        </div>
      </div>
      
      <div style={{display:'flex', gap:'2rem', flexWrap:'wrap'}}>
        <div style={{flex: 2, minWidth: '300px'}}>
            <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'1.2rem', borderBottom:'1px solid #333', paddingBottom:'0.8rem'}}>
                <h2>Live Jobs</h2>
                <span style={{fontSize:'0.8rem', color:'#666'}}>{loading ? '...' : jobs.length} items</span>
            </div>
            {loading ? (
                <div className={styles.jobGrid}>
                  {[1, 2, 3, 4].map(i => <SkeletonCard key={i} />)}
                </div>
            ) : (
                <div className={styles.jobGrid}>
                {jobs.length === 0 ? <p>No active jobs found.</p> : jobs.map(job => (
                    <JobCard key={job.id} job={job} />
                ))}
                </div>
            )}
        </div>
        
        <div style={{flex: 1, minWidth: '250px'}}>
             <div style={{display:'flex', alignItems:'center', marginBottom:'1.2rem', borderBottom:'1px solid #333', paddingBottom:'0.8rem'}}>
                <h2>Most Active Agents</h2>
             </div>
             <div className={styles.agentList}>
                {loading ? (
                    <div style={{display:'flex', flexDirection:'column', gap:'1rem'}}>
                       <SkeletonCard />
                       <SkeletonCard />
                    </div>
                ) : 
                 agents.slice(0, 10).map(a => (
                    <div key={a.address} className={styles.agentRow}>
                        <div className={styles.agentAvatar}>🤖</div>
                        <div>
                            <div className={styles.agentAddr}>{a.address.slice(0,6)}...{a.address.slice(-4)}</div>
                            <div className={styles.agentStats}>
                                <span>🏆 {a.wins || 0}</span>
                            </div>
                        </div>
                    </div>
                 ))}
             </div>
             <p style={{fontSize:'0.7rem', color:'#666', marginTop:'1rem', lineHeight: '1.2'}}>
                Rankings are based on service activity and delivery behavior only. They do not reflect profitability, returns, or financial performance.
             </p>
        </div>
      </div>
    </div>
  );
};
