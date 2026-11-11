import test from 'node:test';
import assert from 'node:assert/strict';
import { vehiclePose, characterPose, hash } from '../src/visuals.js';

test('vehicle presentation remains finite at idle, reverse, speed and full steering', () => {
  for (const boat of [true,false]) for (const speed of [0,-120,440]) for (const steering of [-1,0,1]) {
    const v={x:100,def:{boat},vx:speed,vy:speed/2,lean:steering*.55,turnSign:steering,visualAccel:steering};
    for (const time of [0,1,100000]) {
      const pose=vehiclePose(v,time);
      assert.ok(Object.values(pose).every(Number.isFinite));
      assert.ok(Math.abs(pose.heave)<=1.5 && Math.abs(pose.pitch-1)<=.019);
    }
  }
});

test('reduced motion stops decorative actor motion while retaining steering feedback', () => {
  const v={x:12,def:{boat:true},vx:50,vy:80,turnSign:1,lean:.3,visualAccel:1};
  assert.deepEqual(vehiclePose(v,1,true),vehiclePose(v,500,true));
  const pose=vehiclePose(v,50,true);assert.equal(pose.heave,0);assert.equal(pose.roll,0);assert.equal(pose.pitch,1);assert.ok(pose.wheel>0);
  const a={x:200,dist:100};assert.deepEqual(characterPose(a,true,1,true),characterPose(a,true,10,true));
});

test('character footplant follows travelled distance and recoil settles after a shot', () => {
  const a={x:100,dist:9,shotTick:600};
  assert.ok(characterPose(a,true,10).bob<0);
  assert.equal(characterPose(a,true,10).recoil,1);
  assert.equal(characterPose(a,true,11).recoil,0);
  assert.equal(characterPose(a,false,10,true).bob,0);
});

test('world ambience seeds are stable and bounded for negative and large coordinates', () => {
  for(const n of [-10000,-320,0,1,320,12000,1e7]) {assert.equal(hash(n),hash(n));assert.ok(hash(n)>=0&&hash(n)<1);}
});
