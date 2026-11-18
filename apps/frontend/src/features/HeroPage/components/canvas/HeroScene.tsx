import { useMemo, useState } from 'react';

import { SceneInvalidator } from './SceneInvalidator';
import { HeroCornerLights } from '../../assistant/HeroCornerLights';
import { createHeroDirector } from '../../assistant/heroDirector';
import { ButtonProjector } from '../3d/ButtonProjector';

import {
  useAssistantAccessory,
  useAssistantDirector,
  useAssistantScene,
} from '@/common/components/layout/Assistant';

/**
 * Plugs the hero into the app-wide assistant cube (AssistantHost in
 * MainLayout) while the hero page is mounted. Renders no DOM of its own.
 *
 *  - Director: the entry spin, scroll-timeline pose and callout shift.
 *  - Accessory: the four platform corner lights on the cube body.
 *  - Scene: the SceneInvalidator (requests frames when hero state changes)
 *    and the ButtonProjector (publishes the lights' screen positions to the
 *    hotspots store).
 *
 * Exports:
 *  - HeroScene (default export too).
 */
export function HeroScene() {
  const [director] = useState(createHeroDirector);
  const accessory = useMemo(() => <HeroCornerLights />, []);
  const scene = useMemo(
    () => (
      <>
        <SceneInvalidator />
        <ButtonProjector />
      </>
    ),
    [],
  );

  useAssistantDirector(director);
  useAssistantAccessory(accessory);
  useAssistantScene(scene);
  return null;
}

export default HeroScene;
