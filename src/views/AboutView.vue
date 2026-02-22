<script setup lang="ts">
import { reactive } from 'vue'
import { State } from '../core/state'
import { rectangle, stonesOr, stonesXor, clone, single, south } from '../core/bitboard'
import TheGoban from '../components/TheGoban.vue'

const straightThree = reactive(new State())
straightThree.visualArea = rectangle(9, 6)
straightThree.logicalArea = rectangle(3, 1)
straightThree.player = stonesXor(rectangle(4, 2), straightThree.logicalArea)
straightThree.target = clone(straightThree.player)
straightThree.opponent = stonesXor(rectangle(5, 3), rectangle(4, 2))
straightThree.immortal = clone(straightThree.opponent)
function straightThreePlay(x: number, y: number) {
  straightThree.makeMove(single(x, y))
}

const straightFour = reactive(new State())
straightFour.visualArea = rectangle(9, 6)
straightFour.external = south(south(rectangle(2, 1)))
straightFour.logicalArea = stonesOr(rectangle(4, 1), straightFour.external)
straightFour.player = stonesXor(rectangle(5, 2), rectangle(4, 1))
straightFour.target = clone(straightFour.player)
straightFour.opponent = stonesXor(rectangle(6, 4), rectangle(5, 2))
straightFour.immortal = stonesXor(straightFour.opponent, straightFour.external)
function straightFourPlay(x: number, y: number) {
  straightFour.makeMove(single(x, y))
}

const bentFour = reactive(new State())
bentFour.visualArea = rectangle(9, 6)
bentFour.logicalArea = rectangle(5, 4)
const eyespace = stonesOr(rectangle(3, 1), single(0, 1))
bentFour.opponent = stonesXor(stonesOr(rectangle(4, 2), rectangle(2, 3)), eyespace)
bentFour.whiteToPlay = true
bentFour.koThreats = -1
bentFour.makeMove(single(1, 0))
bentFour.makeMove(single(0, 0))
bentFour.makeMove(single(0, 1))
function bentFourPlay(x: number, y: number) {
  bentFour.makeMove(single(x, y))
}
</script>

<template>
  <main>
    <div class="about">
      <h2>About Life & Death Index</h2>
      <p>
        The go problems are organized into collections that share the same underlying
        <i>root state</i>. Every game state that can be reached from the root is completely solved
        similar to how Chess endgame tables work.
      </p>
      <p>
        The problems need to be self-contained in a tiny portion of the full 19x19 goban. Most of
        the stones you see on the board are only for aesthetics and cannot be interacted with. This
        makes the tsumego unrealistic compared to a real game but it should still contain essential
        features when dealing with similar shapes outside of this database.
      </p>

      <div class="goban-container">
        <TheGoban :state="straightThree" :busy="false" @play="straightThreePlay" />
      </div>
      <i>Unplayable squares are grayed out</i>

      <p>
        To make the problems more tractable sometimes empty space can only be filled in by one
        player.
      </p>
      <div class="goban-container">
        <TheGoban :state="straightFour" :busy="false" @play="straightFourPlay" />
      </div>
      <i>External liberties can only be filled by White</i>

      <p>
        In some problems one of the players may be a virtual <i>ko-master</i>. When a ko-fight
        breaks out, external threats are simulated by one player being able to re-take the ko
        immediately. This is indicated by a red square.
      </p>
      <div class="goban-container">
        <TheGoban :state="bentFour" :busy="false" @play="bentFourPlay" />
      </div>
      <i>Black can take the ko, but White cannot respond</i>

      <p>
        In most problems there is a group of <i>target stones</i>. Capturing them ends the game and
        further scoring is skipped. Failing to capture or save the target stones is shown as "-Ω"
        when exploring the solution space.
      </p>

      <p>
        Otherwise problems are graded at the finest level including sente. The first player to make
        a pass is awarded a <i>button</i> worth ¼ points. Passes don't count towards ending the game
        if the button was taken or there's an active ko on the board. Saving up ko-threats is
        incentivized.
      </p>
      <p>
        To solve a tsumego it's not enough to live, you also need to live with as many points as
        possible.
      </p>
      <p>
        Area scoring / Chinese rules are used. Dead groups are not automatically removed (not yet at
        least).
      </p>

      <h3>Credits / Blame</h3>
      <ul>
        <li>
          Solver Engine <a href="https://github.com/frostburn/tinytsumego2">TinyTsumego v2</a>:
          <i>Lumi Pakkanen</i>
        </li>
        <li>
          Front-end <a href="https://github.com/frostburn/vue-tsumego">VueTsumego</a>:
          <i>Lumi Pakkanen</i>
        </li>
      </ul>
    </div>
  </main>
</template>

<style>
.goban-container {
  margin-top: 1em;
  padding: 0;
  width: 10em;
}
</style>
