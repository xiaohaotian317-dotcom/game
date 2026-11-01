// A busy render frame must not silently discard walking time at 20 FPS.
// Explicit pause/resume resets this clock; catch-up stays bounded after a stall.
export class FrameClock{
 constructor(step=1/120){this.step=step;this.accumulator=0;}
 reset(){this.accumulator=0;}
 advance(elapsed,update){this.accumulator+=Math.max(0,Math.min(.25,Number.isFinite(elapsed)?elapsed:0));let count=0;while(this.accumulator+1e-10>=this.step&&count<30){update(count===0);this.accumulator-=this.step;count++;}return Math.max(0,Math.min(1,this.accumulator/this.step));}
}
