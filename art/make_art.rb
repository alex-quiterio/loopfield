#!/usr/bin/env ruby
# frozen_string_literal: true

# Draws the loopfield logo and the album covers as SVG.
#
# Everything is generated from code with fixed random seeds, so running this
# again produces exactly the same art. Run: ruby art/make_art.rb

require "pathname"

module Art
  OUT = Pathname(__dir__)
  TAU = Math::PI * 2

  SERIF = "'Instrument Serif', 'Iowan Old Style', Georgia, serif"
  CAPS = "Cinzel, 'Trajan Pro', 'Iowan Old Style', Georgia, serif"
  MONO = "'JetBrains Mono', 'SF Mono', Menlo, Consolas, monospace"
  SANS = "'Space Grotesk', 'Helvetica Neue', Helvetica, Arial, sans-serif"

  # Three loops of 3, 5 and 7 lobes: cycles that never quite line up, the way the
  # voices in "One Honest Node" do, around one shared centre.
  RINGS = [[3, 0.355, "#f2c66d", 0.3], [5, 0.265, "#8fa8ff", 1.1], [7, 0.175, "#ffd9c2", 2.0]].freeze

  # A seeded random source with the two draws the art needs.
  class Dice
    def initialize(seed) = @rng = Random.new(seed)
    def rand = @rng.rand
    def uniform(a, b) = a + (b - a) * @rng.rand

    # Box-Muller: a normally distributed number with mean 0 and deviation 1
    def gauss
      u = 1.0 - @rng.rand
      Math.sqrt(-2 * Math.log(u)) * Math.cos(TAU * @rng.rand)
    end

    def choice(list) = list[@rng.rand(list.size)]
  end

  module_function

  def n(x)
    s = format("%.1f", x)
    s.end_with?(".0") ? s[0..-3] : s
  end

  def path(points, close: true)
    d = "M" + points.map { |x, y| "#{n(x)} #{n(y)}" }.join(" L")
    close ? "#{d} Z" : d
  end

  # A circle whose radius swells `lobes` times: one loop of a cycle.
  def lobed_ring(cx, cy, r, amp, lobes, phase = 0.0, steps = 360)
    points = (0...steps).map do |i|
      t = TAU * i / steps
      rr = r + amp * Math.sin(lobes * t + phase)
      [cx + rr * Math.cos(t), cy + rr * Math.sin(t)]
    end
    path(points)
  end

  def svg(w, h, body, defs = "")
    <<~SVG
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 #{w} #{h}" width="#{w}" height="#{h}">
      <defs>#{defs}</defs>
      #{body}
      </svg>
    SVG
  end

  def glow(id, blur)
    %(<filter id="#{id}" x="-50%" y="-50%" width="200%" height="200%">) +
      %(<feGaussianBlur stdDeviation="#{blur}" result="b"/>) +
      %(<feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>)
  end

  def write(name, content)
    file = OUT.join(name)
    file.dirname.mkpath
    file.write(content)
  end

  # --- logo -------------------------------------------------------------------
  def mark(x, y, size, background: true)
    c = size / 2.0
    out = [%(<g transform="translate(#{n(x)} #{n(y)})">)]
    out << %(<rect width="#{n(size)}" height="#{n(size)}" rx="#{n(size * 0.22)}" fill="#070611"/>) if background
    out << %(<g filter="url(#glow)" fill="none" stroke-linejoin="round">)
    RINGS.each do |lobes, r, color, phase|
      out << %(<path d="#{lobed_ring(c, c, size * r, size * 0.028, lobes, phase)}" ) +
             %(stroke="#{color}" stroke-width="#{n(size * 0.024)}"/>)
    end
    out << "</g>"
    out << %(<circle cx="#{n(c)}" cy="#{n(c)}" r="#{n(size * 0.035)}" fill="#f2c66d"/>)
    out << "</g>"
    out.join("\n")
  end

  def logo
    write("logo.svg", svg(512, 512, mark(0, 0, 512), glow("glow", 6)))
    body = [
      %(<rect width="1200" height="360" rx="48" fill="#070611"/>),
      mark(40, 40, 280, background: false),
      %(<text x="360" y="200" font-family="#{MONO}" font-size="112" font-weight="700" ) +
        %(letter-spacing="2" fill="#ece8f6">loopfield</text>),
      %(<text x="364" y="262" font-family="#{SANS}" font-size="30" letter-spacing="7" ) +
        %(fill="#948db6">ALBUMS WRITTEN AS CODE</text>),
    ].join("\n")
    write("logo-wordmark.svg", svg(1200, 360, body, glow("glow", 4)))
  end

  # --- shared cover pieces -------------------------------------------------------
  def stars(dice, count, w, h, top, color, rmax = 1.8)
    Array.new(count) do
      x = dice.uniform(0, w)
      y = dice.uniform(0, h * top)
      %(<circle cx="#{n(x)}" cy="#{n(y)}" r="#{n(dice.uniform(0.5, rmax))}" ) +
        %(fill="#{color}" opacity="#{format('%.2f', dice.uniform(0.25, 0.9))}"/>)
    end.join("\n")
  end

  # A mountain line by midpoint displacement, closed down to the bottom.
  def ridge(dice, y, rough, w = 1000, steps = 9)
    points = [[0, y], [w, y]]
    disp = rough
    steps.times do
      nxt = []
      points.each_cons(2) do |(x0, y0), (x1, y1)|
        nxt << [x0, y0] << [(x0 + x1) / 2.0, (y0 + y1) / 2.0 + dice.uniform(-disp, disp)]
      end
      nxt << points.last
      points = nxt
      disp *= 0.55
    end
    path(points + [[w, 1000], [0, 1000]])
  end

  def footer(label, color)
    mark(48, 44, 56, background: false) +
      %(\n<text x="116" y="80" font-family="#{MONO}" font-size="20" letter-spacing="8" ) +
      %(fill="#{color}">LOOPFIELD · #{label}</text>)
  end

  # --- I · The Quixote Protocol --------------------------------------------------
  def cover_quixote
    dice = Dice.new(1605) # the year Don Quixote was first printed
    defs = '<linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">' \
           '<stop offset="0" stop-color="#05040d"/><stop offset=".5" stop-color="#15103a"/>' \
           '<stop offset=".74" stop-color="#5b3a63"/><stop offset=".86" stop-color="#e08e5a"/>' \
           '<stop offset="1" stop-color="#f2c66d"/></linearGradient>' \
           '<radialGradient id="sun" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#fff1cf"/>' \
           '<stop offset=".4" stop-color="#f2c66d"/><stop offset="1" stop-color="#f2c66d" stop-opacity="0"/></radialGradient>' +
           glow("glow", 3)
    body = [%(<rect width="1000" height="1000" fill="url(#sky)"/>), stars(dice, 260, 1000, 1000, 0.62, "#dfe4ff")]

    # an orbit, and the small sun travelling on it
    body << %(<circle cx="700" cy="250" r="150" fill="none" stroke="#8fa8ff" stroke-opacity=".35" stroke-width="2"/>)
    sx = 700 + 150 * Math.cos(-2.3)
    sy = 250 + 150 * Math.sin(-2.3)
    body << %(<circle cx="#{n(sx)}" cy="#{n(sy)}" r="34" fill="url(#sun)"/>)
    body << %(<circle cx="#{n(sx)}" cy="#{n(sy)}" r="9" fill="#fff1cf"/>)

    # the murmuration: thousands of short strokes along one curving body,
    # dark against the dusk band of the sky
    birds = Array.new(2200) do
      s = dice.rand
      x = 400 + 520 * s + 50 * Math.sin(6.0 * s)
      y = 690 - 160 * Math.sin(Math::PI * s) + 55 * Math.sin(3 * Math::PI * s + 0.4)
      thick = 6 + 46 * Math.sin(Math::PI * s)**0.8 * (0.6 + 0.4 * Math.sin(9 * s))
      ang = dice.gauss * 0.9
      x += Math.cos(ang + 1.3) * dice.gauss * thick
      y += Math.sin(ang + 1.3) * dice.gauss * thick
      dx = 520 + 300 * Math.cos(6.0 * s)
      dy = -160 * Math::PI * Math.cos(Math::PI * s) + 165 * Math::PI * Math.cos(3 * Math::PI * s + 0.4)
      l = Math.hypot(dx, dy).nonzero? || 1
      len = dice.uniform(3, 6)
      "M#{n(x)} #{n(y)} l#{n(dx / l * len)} #{n(dy / l * len)}"
    end
    body << %(<path d="#{birds.join(' ')}" stroke="#0d0919" stroke-width="2.6" stroke-linecap="round" opacity=".9"/>)

    # the hill, and the windmill he mistook for a giant
    body << %(<path d="M0 860 C 180 800, 330 790, 480 830 S 820 880, 1000 840 L1000 1000 L0 1000 Z" fill="#0a0716"/>)
    hx = 300
    hy = 650
    body << %(<path d="M#{hx - 46} 835 L#{hx - 26} #{hy + 20} L#{hx + 26} #{hy + 20} L#{hx + 46} 835 Z" fill="#0a0716"/>)
    body << %(<path d="M#{hx - 34} #{hy + 24} L#{hx} #{hy - 14} L#{hx + 34} #{hy + 24} Z" fill="#0a0716"/>)
    4.times do |k|
      a = (22 + 90 * k) * Math::PI / 180
      ca = Math.cos(a)
      sa = Math.sin(a)
      px = -sa # perpendicular, for the sail width
      py = ca
      x0 = hx + ca * 14
      y0 = hy + sa * 14
      x1 = hx + ca * 210
      y1 = hy + sa * 210
      sail = [[x0, y0], [x1, y1], [x1 + px * 34, y1 + py * 34], [x0 + px * 22, y0 + py * 22]]
      body << %(<path d="#{path(sail)}" fill="#0a0716"/>)
      lattice = (1..8).map do |j|
        f = j / 9.0
        ax = x0 + (x1 - x0) * f
        ay = y0 + (y1 - y0) * f
        w = 22 + 12 * f
        "M#{n(ax)} #{n(ay)} l#{n(px * w)} #{n(py * w)}"
      end
      body << %(<path d="#{lattice.join(' ')}" stroke="#f2c66d" stroke-opacity=".18" stroke-width="1.5"/>)
    end
    body << %(<circle cx="#{hx}" cy="#{hy}" r="10" fill="#0a0716"/>)

    body << footer("I", "#c9c2e6")
    body << %(<text x="500" y="938" text-anchor="middle" font-family="#{SERIF}" font-style="italic" ) +
            %(font-size="64" fill="#f2c66d">The Quixote Protocol</text>)
    write("covers/quixote.svg", svg(1000, 1000, body.join("\n"), defs))
  end

  # --- II · Transmissions from 2089 ----------------------------------------------
  def cover_city
    dice = Dice.new(2089)
    defs = '<pattern id="scan" width="4" height="4" patternUnits="userSpaceOnUse">' \
           '<rect width="4" height="1" fill="#ffffff" opacity=".04"/></pattern>' + glow("glow", 5)
    body = [%(<rect width="1000" height="1000" fill="#05050a"/>)]
    rain = Array.new(320) do
      x = dice.uniform(-100, 1000)
      y = dice.uniform(0, 1000)
      l = dice.uniform(12, 40)
      "M#{n(x)} #{n(y)} l#{n(l * 0.18)} #{n(l)}"
    end
    body << %(<path d="#{rain.join(' ')}" stroke="#3df2ff" stroke-opacity=".16" stroke-width="1.2"/>)

    # a signal ring with a noisy, broken radius, torn into red and cyan
    r = 0.0
    points = Array.new(240) do |i|
      r = r * 0.82 + dice.gauss * 9
      spike = dice.rand < 0.03 ? 40 : 0
      t = TAU * i / 240
      rr = 250 + r + spike
      [500 + rr * Math.cos(t), 450 + rr * Math.sin(t)]
    end
    ring = path(points)
    body << %(<path d="#{ring}" fill="none" stroke="#ff2e4d" stroke-width="5" transform="translate(9 0)" opacity=".85" filter="url(#glow)"/>)
    body << %(<path d="#{ring}" fill="none" stroke="#3df2ff" stroke-width="5" transform="translate(-9 0)" opacity=".75"/>)
    body << %(<path d="#{ring}" fill="none" stroke="#f4f5ff" stroke-width="2"/>)

    # corrupted bands
    14.times do
      y = dice.uniform(150, 760)
      h = dice.uniform(2, 14)
      x = dice.uniform(0, 600)
      w = dice.uniform(120, 500)
      c = dice.choice(["#ff2e4d", "#3df2ff", "#f4f5ff"])
      body << %(<rect x="#{n(x)}" y="#{n(y)}" width="#{n(w)}" height="#{n(h)}" fill="#{c}" opacity="#{format('%.2f', dice.uniform(0.15, 0.6))}"/>)
    end

    body << %(<rect width="1000" height="1000" fill="url(#scan)"/>)
    body << footer("II", "#ff2e4d")
    [[-4, "#3df2ff"], [4, "#ff2e4d"], [0, "#f4f5ff"]].each do |dx, color|
      body << %(<text x="#{60 + dx}" y="880" font-family="#{MONO}" font-size="56" font-weight="800" ) +
              %(letter-spacing="6" fill="#{color}">TRANSMISSIONS</text>) +
              %(<text x="#{60 + dx}" y="944" font-family="#{MONO}" font-size="56" font-weight="800" ) +
              %(letter-spacing="6" fill="#{color}">FROM 2089</text>)
    end
    body << %(<text x="940" y="944" text-anchor="end" font-family="#{MONO}" font-size="16" letter-spacing="4" ) +
            %(fill="#6f7290">SECTOR 7 · 52.37N 4.90E</text>)
    write("covers/city.svg", svg(1000, 1000, body.join("\n"), defs))
  end

  # --- III · The Old World ---------------------------------------------------------
  def cover_old
    dice = Dice.new(1137)
    defs = '<radialGradient id="air" cx=".5" cy=".46" r=".7"><stop offset="0" stop-color="#3a2410"/>' \
           '<stop offset=".55" stop-color="#140f09"/><stop offset="1" stop-color="#07080a"/></radialGradient>' \
           '<radialGradient id="sun" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#fff3d0"/>' \
           '<stop offset=".45" stop-color="#f0c060"/><stop offset="1" stop-color="#e8b04a" stop-opacity="0"/></radialGradient>' \
           '<linearGradient id="gold" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f0dca0"/>' \
           '<stop offset=".6" stop-color="#e8b04a"/><stop offset="1" stop-color="#8a5a1c"/></linearGradient>' +
           glow("glow", 4)
    body = [%(<rect width="1000" height="1000" fill="url(#air)"/>)]
    cx = 500
    cy = 470
    rays = Array.new(96) do |i|
      a = TAU * i / 96
      level = Math.sin(i * 0.37).abs * 0.6 + dice.rand * 0.4 # a frequency spectrum, frozen
      r0 = 120
      r1 = 130 + level * 230
      "M#{n(cx + Math.cos(a) * r0)} #{n(cy + Math.sin(a) * r0)} L#{n(cx + Math.cos(a) * r1)} #{n(cy + Math.sin(a) * r1)}"
    end
    body << %(<path d="#{rays.join(' ')}" stroke="#e8b04a" stroke-width="3" stroke-linecap="round" opacity=".75" filter="url(#glow)"/>)
    body << %(<circle cx="#{cx}" cy="#{cy}" r="190" fill="url(#sun)"/>)
    body << %(<circle cx="#{cx}" cy="#{cy}" r="78" fill="#fff3d0"/>)

    [[600, 150, "#2a1f12"], [680, 120, "#1a140c"], [770, 90, "#0d0b07"]].each do |y, rough, color|
      body << %(<path d="#{ridge(dice, y, rough)}" fill="#{color}"/>)
    end

    body << Array.new(140) do
      x = dice.uniform(0, 1000)
      y = dice.uniform(250, 900)
      %(<circle cx="#{n(x)}" cy="#{n(y)}" r="#{n(dice.uniform(1, 3.2))}" fill="#f0a040" opacity="#{format('%.2f', dice.uniform(0.25, 0.9))}"/>)
    end.join("\n")

    body << footer("III", "#e8b04a")
    body << %(<text x="500" y="918" text-anchor="middle" font-family="#{CAPS}" font-size="78" font-weight="700" ) +
            %(letter-spacing="14" fill="url(#gold)">THE OLD WORLD</text>)
    write("covers/old.svg", svg(1000, 1000, body.join("\n"), defs))
  end

  # --- IV · Edges of the Map ----------------------------------------------------------
  def cover_edge
    dice = Dice.new(7000)
    defs = '<linearGradient id="night" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#03060a"/>' \
           '<stop offset=".7" stop-color="#0b1c2a"/><stop offset="1" stop-color="#12293a"/></linearGradient>' \
           '<radialGradient id="fire" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#ffcf8a"/>' \
           '<stop offset=".35" stop-color="#d98c4a"/><stop offset="1" stop-color="#d98c4a" stop-opacity="0"/></radialGradient>' \
           '<filter id="soft" x="-20%" y="-50%" width="140%" height="200%"><feGaussianBlur stdDeviation="10"/></filter>' +
           glow("glow", 3)
    body = [%(<rect width="1000" height="1000" fill="url(#night)"/>), stars(dice, 180, 1000, 1000, 0.55, "#e8f6ff", 1.5)]

    # aurora: layered curtains, each a sum of slow sines
    6.times do |layer|
      base = 230 + layer * 55
      ph = Array.new(3) { dice.uniform(0, TAU) }
      points = (0..200).map do |i|
        x = i * 5
        y = base + 40 * Math.sin(x * 0.006 + ph[0]) + 22 * Math.sin(x * 0.017 + ph[1]) + 9 * Math.sin(x * 0.05 + ph[2])
        [x, y]
      end
      d = path(points, close: false)
      color = layer.even? ? "#9fdcff" : "#7ff0c8"
      body << %(<path d="#{d}" fill="none" stroke="#{color}" stroke-width="#{34 - layer * 4}" opacity="#{format('%.3f', 0.22 - layer * 0.025)}" filter="url(#soft)"/>)
      body << %(<path d="#{d}" fill="none" stroke="#{color}" stroke-width="1.5" opacity="#{format('%.2f', 0.6 - layer * 0.07)}"/>)
    end

    # the ice shelf, the station on the left and a fire far to the right
    body << %(<path d="M0 760 L240 752 L420 768 L640 756 L1000 764 L1000 1000 L0 1000 Z" fill="#0a141c"/>)
    body << %(<path d="M0 760 L240 752 L420 768 L640 756 L1000 764" fill="none" stroke="#e8f6ff" stroke-opacity=".4" stroke-width="1.5"/>)
    body << %(<rect x="150" y="728" width="54" height="26" fill="#0a141c" stroke="#9fdcff" stroke-opacity=".35"/>)
    body << %(<path d="M188 728 L188 690" stroke="#9fdcff" stroke-opacity=".5" stroke-width="2"/>)
    body << %(<circle cx="188" cy="688" r="3" fill="#ff5a5a" filter="url(#glow)"/>)
    body << %(<rect x="160" y="736" width="8" height="6" fill="#ffe7a8"/>)
    body << %(<circle cx="830" cy="752" r="46" fill="url(#fire)"/>)
    body << %(<circle cx="830" cy="756" r="5" fill="#ffe7a8"/>)

    body << Array.new(240) do
      x = dice.uniform(0, 1000)
      y = dice.uniform(0, 1000)
      %(<circle cx="#{n(x)}" cy="#{n(y)}" r="#{n(dice.uniform(0.8, 2.6))}" fill="#e8f6ff" opacity="#{format('%.2f', dice.uniform(0.2, 0.75))}"/>)
    end.join("\n")

    body << footer("IV", "#9fdcff")
    body << %(<text x="500" y="900" text-anchor="middle" font-family="#{SANS}" font-size="62" font-weight="300" ) +
            %(letter-spacing="20" fill="#e8f6ff">EDGES OF THE MAP</text>)
    body << %(<text x="500" y="946" text-anchor="middle" font-family="#{SANS}" font-size="18" letter-spacing="8" ) +
            %(fill="#7590a0">70°N · AND SOMEWHERE FAR SOUTH</text>)
    write("covers/edge.svg", svg(1000, 1000, body.join("\n"), defs))
  end

  def run
    logo
    cover_quixote
    cover_city
    cover_old
    cover_edge
    OUT.glob("**/*.svg").sort.each do |f|
      puts "#{f.relative_path_from(OUT)}  #{f.size / 1024} KB"
    end
  end
end

Art.run if $PROGRAM_NAME == __FILE__
