import { useState } from 'react';

export function useWallJoints() {
  const [joints, setJoints] = useState<Record<string, string[]>>({});

  const memberKey = (m: { wallId: string; end: 'start' | 'end' }) => `${m.wallId}:${m.end}`;

  function jointMembers(wallId: string, end: 'start' | 'end'): { wallId: string; end: 'start' | 'end' }[] {
    const key = memberKey({ wallId, end });
    for (const members of Object.values(joints)) {
      if (members.includes(key)) {
        return members
          .filter((m) => m !== key)
          .map((m) => {
            const [id, e] = m.split(':');
            return { wallId: id, end: e as 'start' | 'end' };
          });
      }
    }
    return [];
  }

  function joinEndpoints(a: { wallId: string; end: 'start' | 'end' }, b: { wallId: string; end: 'start' | 'end' }) {
    setJoints((prev) => {
      const aKey = memberKey(a);
      const bKey = memberKey(b);
      const touching = Object.entries(prev).filter(([, members]) => members.includes(aKey) || members.includes(bKey));
      const untouched = Object.fromEntries(Object.entries(prev).filter(([id]) => !touching.some(([tid]) => tid === id)));
      const merged = new Set(touching.flatMap(([, members]) => members));
      merged.add(aKey);
      merged.add(bKey);
      return { ...untouched, [touching[0]?.[0] ?? crypto.randomUUID()]: [...merged] };
    });
  }

  function leaveJoint(wallId: string, end: 'start' | 'end') {
    const key = memberKey({ wallId, end });
    setJoints((prev) => {
      const next: typeof prev = {};
      for (const [id, members] of Object.entries(prev)) {
        if (!members.includes(key)) {
          next[id] = members;
          continue;
        }
        const remaining = members.filter((m) => m !== key);
        if (remaining.length >= 2) next[id] = remaining;
      }
      return next;
    });
  }

  function remapJointMember(oldId: string, startOwnerId: string, endOwnerId: string) {
    setJoints((prev) => {
      const next: typeof prev = {};
      for (const [jointId, members] of Object.entries(prev)) {
        next[jointId] = members.map((m) => {
          if (m === `${oldId}:start`) return `${startOwnerId}:start`;
          if (m === `${oldId}:end`) return `${endOwnerId}:end`;
          return m;
        });
      }
      return next;
    });
  }

  return {
    joints,
    setJoints,
    jointMembers,
    joinEndpoints,
    leaveJoint,
    remapJointMember,
  };
}
