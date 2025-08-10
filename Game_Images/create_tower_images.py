#!/usr/bin/env python3
"""
Create medieval Warcraft 3-style tower images for tower defense game.
"""

import os
try:
    from PIL import Image, ImageDraw
    PIL_AVAILABLE = True
except ImportError:
    # If PIL is not available, we'll create simple geometric shapes using built-in libraries
    PIL_AVAILABLE = False
    print("PIL not available, creating simple SVG files instead")

def create_medieval_tower_image(name, base_color, size=64):
    """Create a medieval-style tower image with transparent background."""
    if not PIL_AVAILABLE:
        return create_svg_tower(name, base_color, size)
    
    # Create a new image with transparent background
    img = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    
    center = size // 2
    
    # Define colors
    if isinstance(base_color, str):
        base_color = tuple(int(base_color.replace('0x', ''), 16).to_bytes(3, 'big'))
    
    # Ensure we have RGB tuple
    if len(base_color) == 3:
        base_color = base_color + (255,)  # Add alpha
    
    # Create darker and lighter variants
    darker = tuple(max(0, c - 40) if i < 3 else c for i, c in enumerate(base_color))
    lighter = tuple(min(255, c + 40) if i < 3 else c for i, c in enumerate(base_color))
    
    # Draw castle-like tower structure
    tower_width = size // 2
    tower_height = size * 3 // 4
    tower_x = center - tower_width // 2
    tower_y = size - tower_height
    
    # Main tower body (rectangular)
    draw.rectangle([tower_x, tower_y, tower_x + tower_width, size], 
                  fill=base_color, outline=darker, width=2)
    
    # Add battlements (castle-like top)
    battlement_width = tower_width // 5
    for i in range(5):
        if i % 2 == 0:  # Create crenellations
            batt_x = tower_x + i * battlement_width
            draw.rectangle([batt_x, tower_y - 8, batt_x + battlement_width, tower_y], 
                          fill=lighter, outline=darker, width=1)
    
    # Add windows/details based on tower type
    if 'Cannon' in name:
        # Add cannon barrel
        barrel_y = center
        draw.rectangle([tower_x + tower_width, barrel_y - 3, tower_x + tower_width + 15, barrel_y + 3], 
                      fill=(64, 64, 64, 255), outline=(32, 32, 32, 255))
        # Cannon ball
        draw.ellipse([tower_x + tower_width + 12, barrel_y - 5, tower_x + tower_width + 18, barrel_y + 1], 
                    fill=(48, 48, 48, 255))
    
    elif 'Melee' in name:
        # Add sword/warrior elements
        sword_x = center
        sword_y = tower_y - 5
        # Sword blade
        draw.rectangle([sword_x - 2, sword_y - 15, sword_x + 2, sword_y], 
                      fill=(192, 192, 192, 255), outline=(128, 128, 128, 255))
        # Sword hilt
        draw.rectangle([sword_x - 4, sword_y - 5, sword_x + 4, sword_y], 
                      fill=(139, 69, 19, 255))
        # Add warrior shield
        shield_x = tower_x + tower_width // 4
        shield_y = center
        draw.ellipse([shield_x, shield_y, shield_x + 8, shield_y + 12], 
                    fill=(160, 82, 45, 255), outline=(101, 67, 33, 255))
    
    elif 'Missile' in name or 'Splash' in name:
        # Add missile launcher
        launcher_x = center - 3
        launcher_y = tower_y + 5
        draw.rectangle([launcher_x, launcher_y, launcher_x + 6, launcher_y + 15], 
                      fill=(64, 64, 64, 255))
        # Missile
        draw.polygon([(center, launcher_y - 5), (center - 2, launcher_y), (center + 2, launcher_y)], 
                    fill=(255, 100, 0, 255))
    
    elif 'Anti-Air' in name:
        # Add radar dish/antenna
        antenna_x = center
        antenna_y = tower_y - 5
        # Antenna pole
        draw.line([antenna_x, antenna_y, antenna_x, antenna_y - 20], fill=(128, 128, 128, 255), width=2)
        # Radar dish
        draw.ellipse([antenna_x - 8, antenna_y - 25, antenna_x + 8, antenna_y - 15], 
                    fill=(200, 200, 200, 255), outline=(128, 128, 128, 255))
    
    elif 'Slow' in name:
        # Add ice/frost effects
        # Ice crystals around the tower
        for i in range(6):
            angle = i * 60
            ice_x = center + 20 * (1 if i % 2 == 0 else -1) // 2
            ice_y = center + 15 * (1 if i < 3 else -1) // 2
            draw.polygon([(ice_x, ice_y - 4), (ice_x - 3, ice_y + 4), (ice_x + 3, ice_y + 4)], 
                        fill=(173, 216, 230, 255))
        # Frost aura
        draw.ellipse([center - 25, center - 25, center + 25, center + 25], 
                    outline=(173, 216, 230, 128), width=2)
    
    elif 'Sniper' in name:
        # Add scope/crosshair
        scope_x = center
        scope_y = tower_y + 10
        # Crosshair
        draw.line([scope_x - 8, scope_y, scope_x + 8, scope_y], fill=(255, 255, 255, 255), width=2)
        draw.line([scope_x, scope_y - 8, scope_x, scope_y + 8], fill=(255, 255, 255, 255), width=2)
        # Scope ring
        draw.ellipse([scope_x - 6, scope_y - 6, scope_x + 6, scope_y + 6], 
                    outline=(255, 255, 255, 255), width=2)
        # Rifle barrel
        draw.rectangle([tower_x + tower_width, scope_y - 2, tower_x + tower_width + 20, scope_y + 2], 
                      fill=(64, 64, 64, 255))
    
    elif 'Fire' in name:
        # Add flame effects
        flame_colors = [(255, 100, 0, 255), (255, 150, 0, 255), (255, 200, 0, 255)]
        for i, color in enumerate(flame_colors):
            flame_x = center + (i - 1) * 6
            flame_y = tower_y - 5
            # Flame shape
            draw.polygon([(flame_x, flame_y), (flame_x - 4, flame_y + 12), (flame_x + 4, flame_y + 12)], 
                        fill=color)
        # Add torch holder
        draw.rectangle([center - 2, tower_y - 8, center + 2, tower_y - 2], 
                      fill=(139, 69, 19, 255))
    
    elif 'Water' in name:
        # Add water effects
        # Water droplets
        droplet_colors = [(0, 100, 255, 255), (0, 150, 255, 255), (100, 200, 255, 255)]
        for i, color in enumerate(droplet_colors):
            drop_x = center + (i - 1) * 8
            drop_y = center + (i % 2 - 0.5) * 8
            draw.ellipse([drop_x - 3, drop_y - 4, drop_x + 3, drop_y + 2], fill=color)
        # Water fountain
        draw.rectangle([center - 3, tower_y + 5, center + 3, center], 
                      fill=(100, 149, 237, 255))
    
    elif 'Earth' in name:
        # Add rock/crystal effects
        rock_color = (139, 69, 19, 255)
        crystal_color = (160, 160, 160, 255)
        for i in range(4):
            rock_x = center + (i - 1.5) * 6
            rock_y = center + (i % 2) * 8
            # Rock formations
            draw.polygon([(rock_x, rock_y), (rock_x - 4, rock_y + 8), (rock_x + 4, rock_y + 8)], 
                        fill=rock_color)
            # Small crystals
            draw.polygon([(rock_x, rock_y - 3), (rock_x - 2, rock_y + 2), (rock_x + 2, rock_y + 2)], 
                        fill=crystal_color)
    
    # Add stone texture to base
    for i in range(3):
        for j in range(2):
            stone_x = tower_x + 5 + j * (tower_width // 3)
            stone_y = tower_y + 10 + i * 8
            if stone_x < tower_x + tower_width - 8 and stone_y < size - 8:
                draw.rectangle([stone_x, stone_y, stone_x + 6, stone_y + 6], 
                              outline=darker, width=1)
    
    return img

def create_svg_tower(name, base_color, size=64):
    """Create SVG tower when PIL is not available."""
    # Convert hex color to RGB
    if isinstance(base_color, str):
        hex_color = base_color.replace('0x', '#')
    else:
        hex_color = f"#{base_color[0]:02x}{base_color[1]:02x}{base_color[2]:02x}"
    
    svg_content = f'''<?xml version="1.0" encoding="UTF-8"?>
<svg width="{size}" height="{size}" xmlns="http://www.w3.org/2000/svg">
    <!-- Tower base -->
    <rect x="{size//4}" y="{size//2}" width="{size//2}" height="{size//2}" 
          fill="{hex_color}" stroke="#000" stroke-width="2"/>
    
    <!-- Castle battlements -->
    <rect x="{size//4}" y="{size//2-8}" width="{size//10}" height="8" fill="{hex_color}" stroke="#000"/>
    <rect x="{size//4 + size//5}" y="{size//2-8}" width="{size//10}" height="8" fill="{hex_color}" stroke="#000"/>
    <rect x="{size//4 + 2*size//5}" y="{size//2-8}" width="{size//10}" height="8" fill="{hex_color}" stroke="#000"/>
    
    <!-- Tower type specific elements -->'''
    
    if 'Cannon' in name:
        svg_content += f'''
    <rect x="{size*3//4}" y="{size//2}" width="15" height="6" fill="#404040"/>
    <circle cx="{size*3//4 + 12}" cy="{size//2 + 3}" r="3" fill="#303030"/>'''
    
    elif 'Fire' in name:
        svg_content += f'''
    <polygon points="{size//2},{size//2-5} {size//2-4},{size//2+7} {size//2+4},{size//2+7}" fill="#ff6400"/>
    <polygon points="{size//2-6},{size//2-3} {size//2-10},{size//2+9} {size//2-2},{size//2+9}" fill="#ff9600"/>
    <polygon points="{size//2+6},{size//2-3} {size//2+2},{size//2+9} {size//2+10},{size//2+9}" fill="#ffb400"/>'''
    
    # Add more tower-specific elements as needed
    
    svg_content += '''
</svg>'''
    
    return svg_content

def main():
    """Create all tower images."""
    # Ensure Game_Images directory exists
    os.makedirs('Game_Images', exist_ok=True)
    
    # Define towers based on the game configuration
    towers = [
        ('cannon.png', 'Cannon', (78, 111, 174)),          # 0x4e6fae
        ('melee.png', 'Melee', (222, 110, 110)),           # 0xde6e6e  
        ('missile.png', 'Splash', (110, 222, 138)), # 0x6ede8a
        ('anti_air.png', 'Anti-Air', (158, 110, 222)),     # 0x9e6ede
        ('slow.png', 'Slow', (110, 206, 222)),             # 0x6ecede (frost/ice)
        ('sniper.png', 'Sniper', (142, 68, 173)),          # 0x8e44ad
        ('fire.png', 'Fire', (255, 119, 0)),               # 0xff7700
        ('water.png', 'Water', (0, 153, 255)),             # 0x0099ff
        ('earth.png', 'Earth', (153, 102, 51)),            # 0x996633
    ]
    
    print("Creating medieval tower images...")
    
    for filename, tower_name, color in towers:
        print(f"Creating {filename} for {tower_name} tower...")
        
        if PIL_AVAILABLE:
            img = create_medieval_tower_image(tower_name, color, 64)
            img.save(f'Game_Images/{filename}')
            print(f"✓ Created {filename}")
        else:
            # Create SVG instead
            svg_content = create_svg_tower(tower_name, color, 64)
            svg_filename = filename.replace('.png', '.svg')
            with open(f'Game_Images/{svg_filename}', 'w') as f:
                f.write(svg_content)
            print(f"✓ Created {svg_filename} (SVG format)")
    
    print("\nAll tower images created successfully!")
    print("Images saved in Game_Images/ directory")
    
    if not PIL_AVAILABLE:
        print("\nNote: SVG files created instead of PNG. You may want to convert them to PNG manually.")

if __name__ == "__main__":
    main()
