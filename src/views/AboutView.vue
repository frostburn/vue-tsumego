<script setup lang="ts">
import { reactive } from 'vue'
import { State } from '../core/state'
import { rectangle, stonesOr, stonesXor, clone, single, southPlus } from '../core/bitboard'
import { passStyle } from '../util'
import TheGoban from '../components/TheGoban.vue'
import PlayerIndicator from '../components/PlayerIndicator.vue'

const straightThree = reactive(new State())
straightThree.visualArea = rectangle(9, 6)
straightThree.logicalArea = rectangle(3, 1)
straightThree.player = stonesXor(rectangle(4, 2), straightThree.logicalArea)
straightThree.target = clone(straightThree.player)
straightThree.opponent = stonesXor(rectangle(5, 3), rectangle(4, 2))
straightThree.immortal = clone(straightThree.opponent)
straightThree.trim()
const straightThreePlay = straightThree.makeMove.bind(straightThree)

const straightFour = reactive(new State())
straightFour.visualArea = rectangle(9, 6)
straightFour.external = southPlus(rectangle(2, 1), 2)
straightFour.logicalArea = stonesOr(rectangle(4, 1), straightFour.external)
straightFour.player = stonesXor(rectangle(5, 2), rectangle(4, 1))
straightFour.target = clone(straightFour.player)
straightFour.opponent = stonesXor(rectangle(6, 4), rectangle(5, 2))
straightFour.immortal = stonesXor(straightFour.opponent, straightFour.external)
straightFour.trim()
const straightFourPlay = straightFour.makeMove.bind(straightFour)

const bentFour = reactive(new State())
bentFour.visualArea = rectangle(9, 6)
bentFour.logicalArea = rectangle(5, 4)
const eyespace = stonesOr(rectangle(3, 1), single(0, 1))
bentFour.opponent = stonesXor(stonesOr(rectangle(4, 2), rectangle(2, 3)), eyespace)
bentFour.whiteToPlay = true
bentFour.koThreats = -1
bentFour.trim()
bentFour.makeMove(single(1, 0))
bentFour.makeMove(single(0, 0))
bentFour.makeMove(single(0, 1))
const bentFourPlay = bentFour.makeMove.bind(bentFour)

const RECTANGLE_EIGHT_INFO = {
  moves: [
    {
      x: 0,
      y: 0,
      lowGain: -8,
      highGain: -8,
      lowIdeal: false,
      highIdeal: false,
      forcing: false,
    },
    {
      x: 1,
      y: 0,
      lowGain: 0,
      highGain: 0,
      lowIdeal: true,
      highIdeal: true,
      forcing: true,
    },
    {
      x: 2,
      y: 0,
      lowGain: -8,
      highGain: -8,
      lowIdeal: false,
      highIdeal: false,
      forcing: false,
    },
    {
      x: 3,
      y: 0,
      lowGain: -8,
      highGain: -8,
      lowIdeal: false,
      highIdeal: false,
      forcing: false,
    },
    {
      x: 0,
      y: 1,
      lowGain: -8.5,
      highGain: -8.5,
      lowIdeal: false,
      highIdeal: false,
      forcing: false,
    },
    {
      x: 1,
      y: 1,
      lowGain: -8,
      highGain: -8,
      lowIdeal: false,
      highIdeal: false,
      forcing: false,
    },
    {
      x: 2,
      y: 1,
      lowGain: 0,
      highGain: 0,
      lowIdeal: true,
      highIdeal: true,
      forcing: true,
    },
    {
      x: 3,
      y: 1,
      lowGain: -8.5,
      highGain: -8.5,
      lowIdeal: false,
      highIdeal: false,
      forcing: false,
    },
    {
      x: -1,
      y: -1,
      lowGain: -8,
      highGain: -8,
      lowIdeal: false,
      highIdeal: false,
      forcing: false,
    },
  ],
}
const rectangleEight = reactive(new State())
rectangleEight.visualArea = rectangle(9, 6)
rectangleEight.logicalArea = rectangle(4, 2)
rectangleEight.opponent = stonesXor(rectangle(5, 3), rectangle(4, 2))
rectangleEight.player = stonesXor(rectangle(6, 4), rectangle(5, 3))
rectangleEight.target = clone(rectangleEight.opponent)
rectangleEight.immortal = clone(rectangleEight.player)
rectangleEight.trim()
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

      <div class="goban-container">
        <TheGoban
          :state="rectangleEight"
          :busy="true"
          :passive="true"
          :solutionInfo="RECTANGLE_EIGHT_INFO"
        />
      </div>
      <div class="controls">
        <button disabled :style="passStyle(RECTANGLE_EIGHT_INFO)">pass -8.0</button>
        <div class="indicator-container">
          <PlayerIndicator :whiteToPlay="false" />
        </div>
      </div>
      <p>
        The relative values of moves are shown in Exploration Mode and in Tsumego Mode once the
        problem is successfully or unsuccessfully solved.
      </p>
      <p>
        The best moves lose no points and are shown as "-0.0"
        <a class="footnote-link" href="#blue-footnote">usually</a> with a blue border.
      </p>
      <p>
        In the example above Black has two options for making a seki where neither player gets
        points in the corner which is the optimal result.
      </p>
      <p>
        The "-8.0" moves let White live with eight points but at least Black keeps sente to take the
        <i>button</i>.
      </p>
      <p>
        The "-8.5" moves are so bad that White can take sente/button without endangering the group's
        life whatsoever.
      </p>
      <p>
        The color to play is indicated by the double-circle icon. The Black circle is on top
        indicating that it's <i>Black to Play</i>.
      </p>
      <aside>
        <ol class="footnotes">
          <li id="blue-footnote">
            The backend tracks score ranges instead of single-valued scores. A "-0.0" move may lack
            a blue border if its upper bound is not optimal.
          </li>
        </ol>
      </aside>
      <h3>Credits / Blame</h3>
      <ul>
        <li>
          Solver Engine <a href="https://github.com/frostburn/tinytsumego2">TinyTsumego v2</a>:
          <br />
          <i>Lumi Pakkanen</i>
          <br />
          <i>GPT-5.3-Codex (OpenAI)</i>
        </li>
        <li>
          Front-end <a href="https://github.com/frostburn/vue-tsumego">VueTsumego</a>:
          <br />
          <i>Lumi Pakkanen</i>
          <br />
          <i>GPT-5.3-Codex (OpenAI)</i>
        </li>
      </ul>
    </div>
  </main>
</template>

<style scoped>
.goban-container {
  margin-top: 1em;
  padding: 0;
  width: 22em;
}
.controls {
  display: flex;
}
.indicator-container {
  display: inline-block;
  width: 3.5em;
  margin-left: 0.5em;
}
a.footnote-link {
  counter-increment: footnotes;
  text-decoration: none;
  color: inherit;
  cursor: default;
  outline: none;
}
a.footnote-link:after {
  content: '[' counter(footnotes) ']';
  vertical-align: super;
  font-size: 0.5em;
}
.footnotes {
  padding-inline-start: 1em;
  font-size: 0.75em;
}
aside {
  margin-top: 2em;
  border-top: 1px solid silver;
}
</style>
